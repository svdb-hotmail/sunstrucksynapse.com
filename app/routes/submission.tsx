import { useState } from "react";

import {
  Link,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { SITE_NAME } from "~/config/brand";
import { cloudflareContext } from "~/config/cloudflare-context.server";
import { ReviewAudioUploader } from "~/components/ReviewAudioUploader";
import { createCurationWorkflowRepository } from "~/repositories/curation-workflow.server";
import type { SubmissionAggregate, SubmissionDraftInput } from "~/repositories/submissions.server";
import {
  EVIDENCE_MAX_BYTE_SIZE,
  SubmissionEvidenceService,
  isSupportedEvidenceMimeType,
  normalizeEvidenceMimeType,
  parseEvidenceDeclaration,
} from "~/services/submission-evidence.server";
import { sha256Hex } from "~/services/submission-security.server";
import { SubmissionService, submissionHttpStatus } from "~/services/submissions.server";
import { createTransactionalEmailService } from "~/services/transactional-email.server";
import { computeBlobSha256 } from "~/utils/sha256";

import type { Route } from "./+types/submission";

function formString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function formBool(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

function commaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function combinedRightsContext(draft: SubmissionDraftInput): string {
  return [
    draft.rights.authorityDetails,
    draft.rights.thirdPartyMaterialDetails,
    draft.process.sampleDetails,
    draft.process.voiceCloneDetails,
    draft.process.sourceMaterialContext,
  ]
    .map((value) => value.trim())
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
    .join("\n\n");
}

function hasIndependentThirdPartyMaterial(draft: SubmissionDraftInput): boolean {
  return (
    draft.rights.containsThirdPartyMaterial &&
    !draft.process.samplesUsed &&
    !draft.process.voiceCloneUsed &&
    draft.rights.authorityBasis !== "licensed" &&
    draft.rights.authorityBasis !== "other"
  );
}

function safePublicRightsSummary(
  authorityBasis: SubmissionDraftInput["rights"]["authorityBasis"],
  disclosures: { samplesUsed: boolean; voiceCloneUsed: boolean; thirdPartyMaterialUsed: boolean },
): string {
  const parts = [
    authorityBasis === "original_author"
      ? "The submitter identifies the work as original and under their control."
      : authorityBasis === "licensed"
        ? "The submitter declares that relevant material is used with permission or under licence."
        : authorityBasis === "public_domain"
          ? "The submitter declares that relevant source material is public domain."
          : "The submitter has documented another rights basis for private curator review.",
  ];
  if (disclosures.samplesUsed)
    parts.push("The track includes disclosed sample or source material.");
  if (disclosures.voiceCloneUsed)
    parts.push("The track includes disclosed synthetic or cloned voice material.");
  if (disclosures.thirdPartyMaterialUsed)
    parts.push("The track includes other disclosed third-party material.");
  return parts.join(" ");
}

function readDraft(form: FormData, base: SubmissionDraftInput): SubmissionDraftInput | null {
  const artistName = formString(form, "artist.displayName");
  const trackTitle = formString(form, "track.title");
  const creativeSummary = formString(form, "process.creativeSummary");
  const tools = commaSeparated(formString(form, "process.toolsAndSystems"));
  const territories = commaSeparated(formString(form, "rights.territories"));
  const rightsContext = formString(form, "rights.context");
  const confirmed = formBool(form, "ack.confirmed");
  const authorityBasisValue = formString(form, "rights.authorityBasis");
  let authorityBasis: SubmissionDraftInput["rights"]["authorityBasis"];
  switch (authorityBasisValue) {
    case "original_author":
    case "licensed":
    case "public_domain":
    case "other":
      authorityBasis = authorityBasisValue;
      break;
    default:
      return null;
  }
  const samplesUsed = formBool(form, "process.samplesUsed");
  const voiceCloneUsed = formBool(form, "process.voiceCloneUsed");
  const thirdPartyMaterialUsed = formBool(form, "rights.containsThirdPartyMaterial");
  const previousRightsContext = combinedRightsContext(base);
  const rightsContextChanged = rightsContext !== previousRightsContext;
  const containsThirdPartyMaterial =
    thirdPartyMaterialUsed ||
    samplesUsed ||
    voiceCloneUsed ||
    authorityBasis === "licensed" ||
    authorityBasis === "other";
  const rightsStatement =
    rightsContext ||
    (authorityBasis === "licensed"
      ? "The submitter confirms the material is used with permission."
      : authorityBasis === "public_domain"
        ? "The submitter identifies the relevant material as public domain."
        : "The submitter confirms control of the rights needed for review.");
  const publicRightsSummary = safePublicRightsSummary(authorityBasis, {
    samplesUsed,
    voiceCloneUsed,
    thirdPartyMaterialUsed,
  });
  const existingHumanRole = base.process.humanRoles[0];
  const existingTools = new Map(
    base.process.aiTools.map((tool) => [tool.name.toLowerCase(), tool]),
  );

  return {
    ...base,
    submissionKind: "track",
    workTitle: trackTitle,
    artist: {
      ...base.artist,
      displayName: artistName,
      shortBiography: formString(form, "artist.shortBiography"),
      websiteUrl: formString(form, "artist.websiteUrl"),
      socialUrl: formString(form, "artist.socialUrl"),
    },
    release: {
      ...base.release,
      title: trackTitle,
      plannedReleaseDate: formString(form, "release.plannedReleaseDate"),
      territories,
    },
    track: {
      ...base.track,
      title: trackTitle,
    },
    contact: {
      ...base.contact,
      contactName: artistName,
      contactEmail: formString(form, "contact.contactEmail"),
      preferredContactMethod: "email",
    },
    acknowledgements: {
      invitationConfirmed: confirmed,
      accuracyConfirmed: confirmed,
      rightsConfirmed: confirmed,
      disclosureConfirmed: confirmed,
      reviewProcessConfirmed: confirmed,
    },
    rights: {
      ...base.rights,
      authorityBasis,
      authorityDetails: rightsContextChanged ? rightsContext : base.rights.authorityDetails,
      entitlementStatement: rightsStatement,
      publicSummary: publicRightsSummary,
      containsThirdPartyMaterial,
      thirdPartyMaterialDetails: containsThirdPartyMaterial
        ? rightsContextChanged
          ? rightsContext
          : base.rights.thirdPartyMaterialDetails || rightsContext
        : "",
      territories,
      isrc: formString(form, "rights.isrc"),
      attestation: confirmed
        ? "I confirm that this submission and its rights and creative-process information are accurate."
        : "",
    },
    process: {
      ...base.process,
      aiUsed: true,
      aiUseDescription: creativeSummary,
      meaningfulHumanContribution: creativeSummary,
      toolsAndSystems: tools,
      humanRoles: [
        {
          name: artistName,
          role: existingHumanRole?.role || "artist",
          contribution: creativeSummary,
          isPublic: existingHumanRole?.isPublic ?? true,
        },
        ...base.process.humanRoles.slice(1),
      ],
      aiTools: tools.map((name) => {
        const existing = existingTools.get(name.toLowerCase());
        return {
          name,
          model: existing?.model ?? "",
          provider: existing?.provider ?? "",
          purpose: existing?.purpose || "Creative assistance",
          isPublic: existing?.isPublic ?? true,
        };
      }),
      sourceMaterialContext: rightsContextChanged
        ? rightsContext
        : base.process.sourceMaterialContext || rightsContext,
      publicSummary: creativeSummary,
      voiceCloneUsed,
      voiceCloneDetails: voiceCloneUsed
        ? rightsContextChanged
          ? rightsContext
          : base.process.voiceCloneDetails || rightsContext
        : "",
      samplesUsed,
      sampleDetails: samplesUsed
        ? rightsContextChanged
          ? rightsContext
          : base.process.sampleDetails || rightsContext
        : "",
    },
    provenance: {
      ...base.provenance,
      summary: creativeSummary,
    },
  };
}

function draftFromAggregate(aggregate: SubmissionAggregate): SubmissionDraftInput {
  return {
    submissionKind: aggregate.submission.submissionKind,
    workTitle: aggregate.submission.title,
    artist: aggregate.submission.artistDetails,
    release: aggregate.submission.releaseDetails,
    track: aggregate.submission.trackDetails,
    contact: aggregate.submission.contactDetails,
    acknowledgements: aggregate.submission.acknowledgements,
    rights: {
      authorityBasis: aggregate.rights.authorityBasis,
      authorityDetails: aggregate.rights.authorityDetails,
      entitlementStatement: aggregate.rights.entitlementStatement,
      publicSummary: aggregate.rights.publicSummary,
      publicNotes: aggregate.rights.publicNotes,
      privateNotes: aggregate.rights.privateNotes,
      containsThirdPartyMaterial: aggregate.rights.containsThirdPartyMaterial,
      thirdPartyMaterialDetails: aggregate.rights.thirdPartyMaterialDetails,
      restrictions: aggregate.rights.restrictions,
      territories: aggregate.rights.territories,
      distributorName: aggregate.rights.distributorName,
      distributorReleaseId: aggregate.rights.distributorReleaseId,
      isrc: aggregate.rights.isrc,
      attestation: aggregate.rights.attestation,
    },
    process: {
      aiUsed: aggregate.process.aiUsed,
      aiUseDescription: aggregate.process.aiUseDescription,
      meaningfulHumanContribution: aggregate.process.meaningfulHumanContribution,
      toolsAndSystems: aggregate.process.toolsAndSystems,
      humanRoles: aggregate.process.humanRoles,
      aiTools: aggregate.process.aiTools,
      lyricsUsed: aggregate.process.lyricsUsed,
      lyricsDetails: aggregate.process.lyricsDetails,
      voiceCloneUsed: aggregate.process.voiceCloneUsed,
      voiceCloneDetails: aggregate.process.voiceCloneDetails,
      samplesUsed: aggregate.process.samplesUsed,
      sampleDetails: aggregate.process.sampleDetails,
      sourceMaterialContext: aggregate.process.sourceMaterialContext,
      publicSummary: aggregate.process.publicSummary,
      privateNotes: aggregate.process.privateNotes,
    },
    provenance: {
      summary: aggregate.provenance.summary,
      publicNotes: aggregate.provenance.publicNotes,
      privateNotes: aggregate.provenance.privateNotes,
      steps: aggregate.provenance.steps,
      sources: aggregate.provenance.sources,
    },
  };
}

function blankData(inviteeName: string | null, inviteeEmail: string): SubmissionDraftInput {
  return {
    submissionKind: "track",
    workTitle: "",
    artist: {
      displayName: inviteeName ?? "",
      shortBiography: "",
      location: "",
      websiteUrl: "",
      socialUrl: "",
      priorWorkNotes: "",
    },
    release: {
      title: "",
      summary: "",
      plannedReleaseDate: "",
      labelName: "",
      distributorName: "",
      distributorReleaseId: "",
      territories: ["Worldwide"],
    },
    track: {
      title: "",
      versionTitle: "",
      durationNotes: "",
      isLeadSingle: false,
      lyricsSummary: "",
      isInstrumental: false,
    },
    contact: {
      contactName: inviteeName ?? "",
      contactEmail: inviteeEmail,
      contactPhone: "",
      preferredContactMethod: "email",
    },
    acknowledgements: {
      invitationConfirmed: false,
      accuracyConfirmed: false,
      rightsConfirmed: false,
      disclosureConfirmed: false,
      reviewProcessConfirmed: false,
    },
    rights: {
      authorityBasis: "original_author",
      authorityDetails: "",
      entitlementStatement: "",
      publicSummary: "",
      publicNotes: "",
      privateNotes: "",
      containsThirdPartyMaterial: false,
      thirdPartyMaterialDetails: "",
      restrictions: "",
      territories: ["Worldwide"],
      distributorName: "",
      distributorReleaseId: "",
      isrc: "",
      attestation: "",
    },
    process: {
      aiUsed: true,
      aiUseDescription: "",
      meaningfulHumanContribution: "",
      toolsAndSystems: [],
      humanRoles: [],
      aiTools: [],
      lyricsUsed: false,
      lyricsDetails: "",
      voiceCloneUsed: false,
      voiceCloneDetails: "",
      samplesUsed: false,
      sampleDetails: "",
      sourceMaterialContext: "",
      publicSummary: "",
      privateNotes: "",
    },
    provenance: {
      summary: "",
      publicNotes: "",
      privateNotes: "",
      steps: [],
      sources: [],
    },
  };
}

function flowMessage(url: URL) {
  if (url.searchParams.get("submitted"))
    return "Submission received. We sent a confirmation if email delivery is configured.";
  if (url.searchParams.get("saved")) return "Draft saved.";
  if (url.searchParams.get("uploaded")) return "Evidence uploaded for curator review.";
  if (url.searchParams.get("withdrawn"))
    return "Submission withdrawn. Existing audit history remains retained.";
  return null;
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  if (!runtime.submissionRepository) {
    throw new Response("Submission service unavailable.", { status: 503 });
  }
  const service = new SubmissionService(
    runtime.submissionRepository,
    createTransactionalEmailService(runtime.env),
  );
  const rawToken = params.invitationToken ?? "";
  const tokenHash = sha256Hex(rawToken);
  const invitation = await service.loadInvitation(tokenHash);
  if (!invitation) {
    throw new Response("Submission link unavailable.", { status: 404, statusText: "Not found" });
  }
  const aggregate = await service.loadPublic(tokenHash);
  const workflowRepository =
    runtime.curationWorkflowRepository ??
    (runtime.db ? createCurationWorkflowRepository(runtime.db) : null);
  const reviewAudio = workflowRepository
    ? await workflowRepository.currentAudioByTokenHash(tokenHash, new Date())
    : null;
  return {
    invitation,
    aggregate,
    initialDraft: aggregate
      ? draftFromAggregate(aggregate)
      : blankData(invitation.inviteeName, invitation.inviteeEmail),
    flash: flowMessage(new URL(request.url)),
    reviewAudio,
    reviewAudioEndpoint: `/submit/${encodeURIComponent(rawToken)}/review-audio`,
  };
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const runtime = context.get(cloudflareContext);
  if (!runtime.submissionRepository) {
    return Response.json({ error: "Submission service unavailable." }, { status: 503 });
  }
  const rawToken = params.invitationToken ?? "";
  const tokenHash = sha256Hex(rawToken);
  if (!runtime.rateLimitRepository) {
    return Response.json({ error: "Submission service unavailable." }, { status: 503 });
  }
  const rateLimit = await runtime.rateLimitRepository.consume(
    "submission_mutation",
    tokenHash,
    30,
    300,
  );
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Wait before trying again." },
      {
        status: 429,
        headers: { "retry-after": String(rateLimit.retryAfterSeconds) },
      },
    );
  }
  const email = createTransactionalEmailService(runtime.env);
  const service = new SubmissionService(runtime.submissionRepository, email);
  const form = await request.formData();
  const intent = formString(form, "intent");
  const abuseMeta = {
    honeypotTriggered: Boolean(formString(form, "website")),
    userAgent: request.headers.get("user-agent"),
    ipHash: request.headers.get("cf-connecting-ip")
      ? sha256Hex(String(request.headers.get("cf-connecting-ip")))
      : null,
  };

  if (intent === "upload-evidence") {
    if (!runtime.env || !runtime.db) {
      return Response.json({ error: "Evidence uploads are unavailable." }, { status: 503 });
    }
    const file = form.get("evidence");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "Choose an evidence file." }, { status: 400 });
    }
    const mimeType = normalizeEvidenceMimeType(file.type);
    if (!isSupportedEvidenceMimeType(mimeType)) {
      return Response.json({ error: "Unsupported evidence MIME type." }, { status: 400 });
    }
    if (file.size > EVIDENCE_MAX_BYTE_SIZE) {
      return Response.json({ error: "Evidence exceeds the 20 MiB limit." }, { status: 413 });
    }
    const declaration = parseEvidenceDeclaration({
      filename: file.name,
      mimeType,
      checksumSha256: await computeBlobSha256(file),
      byteSize: file.size,
    });
    if (!declaration.ok) {
      return Response.json({ error: declaration.message }, { status: declaration.status });
    }
    const session = await new SubmissionEvidenceService(
      runtime.db,
      runtime.submissionRepository,
      runtime.env,
    ).createSession(tokenHash, declaration.value);
    if (!session) {
      return Response.json({ error: "Save a draft before uploading evidence." }, { status: 409 });
    }
    const uploadRequest = new Request(request.url, {
      method: "PUT",
      headers: {
        "content-type": declaration.value.mimeType,
        "content-length": String(file.size),
      },
      body: file.stream(),
      duplex: "half",
    } as RequestInit);
    const evidenceService = new SubmissionEvidenceService(
      runtime.db,
      runtime.submissionRepository,
      runtime.env,
    );
    const uploaded = await evidenceService.upload(session.id, uploadRequest);
    if (!uploaded.ok) {
      return Response.json({ error: uploaded.message }, { status: uploaded.status });
    }
    const completed = await evidenceService.complete(session.id);
    if (!completed.ok) {
      return Response.json({ error: completed.message }, { status: completed.status });
    }
    return redirect(`/submit/${params.invitationToken}?uploaded=1`);
  }

  if (intent === "withdraw") {
    const result = await service.withdraw(tokenHash, formString(form, "withdrawMessage") || null);
    if (!result.ok) {
      const error = result.error as {
        message: string;
        code: Parameters<typeof submissionHttpStatus>[0];
      };
      return Response.json({ error: error.message }, { status: submissionHttpStatus(error.code) });
    }
    return redirect(`/submit/${params.invitationToken}?withdrawn=1`);
  }

  const invitation = await service.loadInvitation(tokenHash);
  if (!invitation) {
    return Response.json({ error: "Submission link unavailable." }, { status: 404 });
  }
  const aggregate = await service.loadPublic(tokenHash);

  if (intent === "submit") {
    if (!aggregate) {
      return Response.json({ error: "Save the track details before submitting." }, { status: 409 });
    }
    const workflowRepository =
      runtime.curationWorkflowRepository ??
      (runtime.db ? createCurationWorkflowRepository(runtime.db) : null);
    const reviewAudio = workflowRepository
      ? await workflowRepository.currentAudioByTokenHash(tokenHash, new Date())
      : null;
    if (!reviewAudio) {
      return Response.json(
        { error: "Upload a private listening copy before submitting." },
        { status: 409 },
      );
    }
    const result = await service.submit(tokenHash, draftFromAggregate(aggregate), abuseMeta);
    if (!result.ok) {
      return Response.json(
        { error: result.error.message },
        { status: submissionHttpStatus(result.error.code) },
      );
    }
    return redirect(`/submit/${params.invitationToken}?submitted=1`);
  }

  const base = aggregate
    ? draftFromAggregate(aggregate)
    : blankData(invitation.inviteeName, invitation.inviteeEmail);
  const draft = readDraft(form, base);
  if (!draft) {
    return Response.json({ error: "Choose a supported rights basis." }, { status: 400 });
  }
  if (intent === "save-draft") {
    const result = await service.saveDraft(tokenHash, draft, abuseMeta);
    if (!result.ok) {
      return Response.json(
        { error: result.error.message },
        { status: submissionHttpStatus(result.error.code) },
      );
    }
    return redirect(`/submit/${params.invitationToken}?saved=1#review-audio`);
  }
  return Response.json({ error: "Unsupported submission action." }, { status: 400 });
}

function DraftInput({
  name,
  label,
  defaultValue = "",
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={defaultValue} required={required} />
    </label>
  );
}

function DraftTextArea({
  name,
  label,
  defaultValue = "",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <textarea name={name} defaultValue={defaultValue} rows={4} required={required} />
    </label>
  );
}

export const meta: Route.MetaFunction = () => [{ title: `Invitation submission | ${SITE_NAME}` }];

export default function SubmissionRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const draft = data.initialDraft;
  const status = data.aggregate?.submission.status ?? "draft";
  const detailsEditable =
    !data.aggregate || status === "draft" || status === "clarification_requested";
  const audioEditable =
    Boolean(data.aggregate) && (status === "draft" || status === "clarification_requested");
  const acknowledgementConfirmed = Object.values(draft.acknowledgements).every(Boolean);
  const savingDetails =
    navigation.state === "submitting" && navigation.formData?.get("intent") === "save-draft";
  const [editingDetails, setEditingDetails] = useState(!data.aggregate);
  const [lastSubmittedIntent, setLastSubmittedIntent] = useState<string | null>(null);
  const showDetailsEditor =
    editingDetails || (Boolean(actionData?.error) && lastSubmittedIntent === "save-draft");
  const readyToSubmit = audioEditable && Boolean(data.reviewAudio) && !showDetailsEditor;

  return (
    <main className="entity-page submission-page">
      <p className="eyebrow">Invitation submission</p>
      <h1>Send us one track</h1>
      <p className="submission-intro">
        Add the essentials, upload the finished audio, and submit. It should take only a few
        minutes.
      </p>
      <p className="submission-reference">
        Invite <strong>{data.invitation.publicReference}</strong>
        {data.aggregate ? (
          <>
            {" · "}Submission <strong>{data.aggregate.submission.publicReference}</strong>
          </>
        ) : null}
      </p>
      {data.flash ? (
        <p className="submission-notice" role="status">
          {data.flash}
        </p>
      ) : null}
      {actionData?.error ? (
        <p className="submission-notice submission-notice-error" role="alert">
          {actionData.error}
        </p>
      ) : null}

      <Form
        id="submission-details-form"
        method="post"
        className="submission-intake-form"
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const submittedIntent = submitter instanceof HTMLButtonElement ? submitter.value : null;
          setLastSubmittedIntent(submittedIntent);
          if (submittedIntent === "save-draft") setEditingDetails(false);
        }}
      >
        <input type="hidden" name="website" />
        <section className="submission-step-card" aria-labelledby="submission-details-heading">
          <div className="submission-step-heading">
            <span aria-hidden="true">1</span>
            <div>
              <p className="eyebrow">Track details</p>
              <h2 id="submission-details-heading">Tell us what we are hearing</h2>
            </div>
          </div>
          <div className="submission-details-editor" hidden={!showDetailsEditor}>
            <div className="submission-field-grid">
              <DraftInput
                name="artist.displayName"
                label="Artist name"
                defaultValue={draft.artist.displayName}
                required
              />
              <DraftInput
                name="track.title"
                label="Track title"
                defaultValue={draft.track.title}
                required
              />
              <DraftInput
                name="contact.contactEmail"
                label="Contact email"
                defaultValue={draft.contact.contactEmail}
                type="email"
                required
              />
              <div className="submission-field-full">
                <DraftTextArea
                  name="process.creativeSummary"
                  label="How was this track made, and what did you contribute?"
                  defaultValue={draft.process.meaningfulHumanContribution}
                  required
                />
                <p className="submission-field-help">
                  A few plain sentences are enough. Mention the important creative decisions you
                  made.
                </p>
              </div>
              <DraftInput
                name="process.toolsAndSystems"
                label="AI tools used (comma separated)"
                defaultValue={draft.process.toolsAndSystems.join(", ")}
                required
              />
              <label>
                Rights basis
                <select
                  name="rights.authorityBasis"
                  defaultValue={draft.rights.authorityBasis}
                  required
                >
                  <option value="original_author">I made and control the work</option>
                  <option value="licensed">I have permission or a licence</option>
                  <option value="public_domain">The source material is public domain</option>
                  <option value="other">Other — explain below</option>
                </select>
              </label>
              <DraftInput
                name="rights.territories"
                label="Where do you have these rights?"
                defaultValue={draft.rights.territories.join(", ") || "Worldwide"}
                required
              />
              <div className="submission-field-full">
                <fieldset className="submission-disclosure-options">
                  <legend>Does the track include any of these?</legend>
                  <label>
                    <input
                      type="checkbox"
                      name="process.samplesUsed"
                      defaultChecked={draft.process.samplesUsed}
                    />
                    Samples or source recordings
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="process.voiceCloneUsed"
                      defaultChecked={draft.process.voiceCloneUsed}
                    />
                    A cloned or synthetic version of a real person&apos;s voice
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="rights.containsThirdPartyMaterial"
                      defaultChecked={hasIndependentThirdPartyMaterial(draft)}
                    />
                    Other third-party material
                  </label>
                </fieldset>
                <DraftTextArea
                  name="rights.context"
                  label="Rights details (required if you selected anything above or chose licensed/other)"
                  defaultValue={combinedRightsContext(draft)}
                />
              </div>
            </div>

            <details className="submission-optional">
              <summary>Optional release details</summary>
              <div className="submission-field-grid">
                <DraftTextArea
                  name="artist.shortBiography"
                  label="Short artist biography"
                  defaultValue={draft.artist.shortBiography}
                />
                <DraftInput
                  name="artist.websiteUrl"
                  label="Website"
                  defaultValue={draft.artist.websiteUrl}
                  type="url"
                />
                <DraftInput
                  name="artist.socialUrl"
                  label="Social profile"
                  defaultValue={draft.artist.socialUrl}
                  type="url"
                />
                <DraftInput
                  name="release.plannedReleaseDate"
                  label="Planned release date"
                  defaultValue={draft.release.plannedReleaseDate}
                  type="date"
                />
                <DraftInput name="rights.isrc" label="ISRC" defaultValue={draft.rights.isrc} />
              </div>
            </details>

            <label className="submission-confirmation">
              <input
                type="checkbox"
                name="ack.confirmed"
                defaultChecked={acknowledgementConfirmed}
                required
              />
              <span>
                This invitation is mine. The information is accurate, I control or have permission
                for the material, and I have disclosed the creative process. I understand review
                does not guarantee publication.
              </span>
            </label>

            <div className="submission-step-action">
              <button
                type="submit"
                name="intent"
                value="save-draft"
                disabled={!detailsEditable || savingDetails}
              >
                {savingDetails
                  ? "Saving…"
                  : data.aggregate
                    ? "Save changes"
                    : "Save details and continue"}
              </button>
              {!detailsEditable ? <span>Details are locked after submission.</span> : null}
            </div>
          </div>
          {!showDetailsEditor ? (
            <div className="submission-saved-summary">
              <div>
                <p>
                  <strong>{draft.artist.displayName}</strong> — {draft.track.title}
                </p>
                <p>
                  {audioEditable
                    ? "Details saved. Continue with the private listening copy below."
                    : "This submission has already been sent for review."}
                </p>
              </div>
              {detailsEditable ? (
                <button type="button" onClick={() => setEditingDetails(true)}>
                  Edit details
                </button>
              ) : (
                <span>Details are locked after submission.</span>
              )}
            </div>
          ) : null}
        </section>
      </Form>

      <div id="review-audio" className="submission-audio-step">
        <div className="submission-step-heading">
          <span aria-hidden="true">2</span>
          <div>
            <p className="eyebrow">Private listening copy</p>
            <h2>Upload the finished track</h2>
          </div>
        </div>
        <ReviewAudioUploader
          endpoint={data.reviewAudioEndpoint}
          currentAudio={data.reviewAudio}
          disabled={!audioEditable}
          showHeading={false}
          disabledMessage={
            !data.aggregate
              ? "Save the track details first."
              : "The listening copy is locked after submission."
          }
        />
      </div>

      <section className="submission-step-card" aria-labelledby="submission-send-heading">
        <div className="submission-step-heading">
          <span aria-hidden="true">3</span>
          <div>
            <p className="eyebrow">Final check</p>
            <h2 id="submission-send-heading">Submit for review</h2>
          </div>
        </div>
        {status === "received" ? (
          <p className="submission-complete">Your track has been submitted. You are done.</p>
        ) : (
          <>
            <p>
              {data.reviewAudio
                ? "Your details and private listening copy are ready."
                : "Upload the private listening copy to unlock submission."}
            </p>
            <button
              type="submit"
              form="submission-details-form"
              name="intent"
              value="submit"
              disabled={!readyToSubmit}
            >
              Submit track for review
            </button>
          </>
        )}
      </section>

      {data.aggregate ? (
        <details className="submission-secondary-actions">
          <summary>Only if the curator asks for more</summary>
          <section>
            <h2>Supporting evidence</h2>
            <p>
              Evidence stays private and is never shown on public pages. Do not upload anything
              unless it helps answer a curator question.
            </p>
            <Form method="post" encType="multipart/form-data" className="curator-form">
              <input type="hidden" name="intent" value="upload-evidence" />
              <input type="hidden" name="website" />
              <label>
                Evidence file
                <input type="file" name="evidence" />
              </label>
              <button type="submit">Upload evidence</button>
            </Form>
            {data.aggregate.evidence.length ? (
              <ul>
                {data.aggregate.evidence.map((evidence) => (
                  <li key={evidence.id}>
                    {evidence.originalFilename} · {evidence.mimeType} · {evidence.byteSize} bytes ·{" "}
                    {evidence.malwareStatus}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </details>
      ) : null}

      {data.aggregate ? (
        <details className="submission-secondary-actions">
          <summary>Withdraw this submission</summary>
          <Form method="post" className="curator-form">
            <input type="hidden" name="intent" value="withdraw" />
            <DraftTextArea name="withdrawMessage" label="Optional note" />
            <button type="submit" disabled={status === "accepted" || status === "rejected"}>
              Withdraw submission
            </button>
          </Form>
        </details>
      ) : null}

      <p className="submission-legal">
        By continuing you agree to the <Link to="/submission-terms">submission terms</Link>. See our{" "}
        <Link to="/privacy">privacy notice</Link> and <Link to="/takedown">takedown process</Link>.
      </p>
    </main>
  );
}
