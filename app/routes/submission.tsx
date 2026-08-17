import {
  Link,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { cloudflareContext } from "~/config/cloudflare-context.server";
import type { SubmissionDraftInput } from "~/repositories/submissions.server";
import {
  SubmissionEvidenceService,
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

function collectIndexed<T>(
  form: FormData,
  count: number,
  reader: (index: number) => T | null,
): T[] {
  const values: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const value = reader(index);
    if (value) values.push(value);
  }
  return values;
}

function readDraft(form: FormData): SubmissionDraftInput {
  return {
    submissionKind: formString(form, "submissionKind") === "release" ? "release" : "track",
    workTitle: formString(form, "workTitle"),
    artist: {
      displayName: formString(form, "artist.displayName"),
      shortBiography: formString(form, "artist.shortBiography"),
      location: formString(form, "artist.location"),
      websiteUrl: formString(form, "artist.websiteUrl"),
      socialUrl: formString(form, "artist.socialUrl"),
      priorWorkNotes: formString(form, "artist.priorWorkNotes"),
    },
    release: {
      title: formString(form, "release.title"),
      summary: formString(form, "release.summary"),
      plannedReleaseDate: formString(form, "release.plannedReleaseDate"),
      labelName: formString(form, "release.labelName"),
      distributorName: formString(form, "release.distributorName"),
      distributorReleaseId: formString(form, "release.distributorReleaseId"),
      territories: formString(form, "release.territories")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    },
    track: {
      title: formString(form, "track.title"),
      versionTitle: formString(form, "track.versionTitle"),
      durationNotes: formString(form, "track.durationNotes"),
      isLeadSingle: formBool(form, "track.isLeadSingle"),
      lyricsSummary: formString(form, "track.lyricsSummary"),
      isInstrumental: formBool(form, "track.isInstrumental"),
    },
    contact: {
      contactName: formString(form, "contact.contactName"),
      contactEmail: formString(form, "contact.contactEmail"),
      contactPhone: formString(form, "contact.contactPhone"),
      preferredContactMethod:
        formString(form, "contact.preferredContactMethod") === "phone" ? "phone" : "email",
    },
    acknowledgements: {
      invitationConfirmed: formBool(form, "ack.invitationConfirmed"),
      accuracyConfirmed: formBool(form, "ack.accuracyConfirmed"),
      rightsConfirmed: formBool(form, "ack.rightsConfirmed"),
      disclosureConfirmed: formBool(form, "ack.disclosureConfirmed"),
      reviewProcessConfirmed: formBool(form, "ack.reviewProcessConfirmed"),
    },
    rights: {
      authorityBasis:
        formString(form, "rights.authorityBasis") === "licensed"
          ? "licensed"
          : formString(form, "rights.authorityBasis") === "public_domain"
            ? "public_domain"
            : formString(form, "rights.authorityBasis") === "other"
              ? "other"
              : "original_author",
      authorityDetails: formString(form, "rights.authorityDetails"),
      entitlementStatement: formString(form, "rights.entitlementStatement"),
      publicSummary: formString(form, "rights.publicSummary"),
      publicNotes: formString(form, "rights.publicNotes"),
      privateNotes: formString(form, "rights.privateNotes"),
      containsThirdPartyMaterial: formBool(form, "rights.containsThirdPartyMaterial"),
      thirdPartyMaterialDetails: formString(form, "rights.thirdPartyMaterialDetails"),
      restrictions: formString(form, "rights.restrictions"),
      territories: formString(form, "rights.territories")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      distributorName: formString(form, "rights.distributorName"),
      distributorReleaseId: formString(form, "rights.distributorReleaseId"),
      isrc: formString(form, "rights.isrc"),
      attestation: formString(form, "rights.attestation"),
    },
    process: {
      aiUsed: formBool(form, "process.aiUsed"),
      aiUseDescription: formString(form, "process.aiUseDescription"),
      meaningfulHumanContribution: formString(form, "process.meaningfulHumanContribution"),
      toolsAndSystems: formString(form, "process.toolsAndSystems")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      humanRoles: collectIndexed(form, 2, (index) => {
        const name = formString(form, `process.humanRoles.${index}.name`);
        const role = formString(form, `process.humanRoles.${index}.role`);
        const contribution = formString(form, `process.humanRoles.${index}.contribution`);
        if (!name && !role && !contribution) return null;
        return {
          name,
          role,
          contribution,
          isPublic: formBool(form, `process.humanRoles.${index}.isPublic`),
        };
      }),
      aiTools: collectIndexed(form, 2, (index) => {
        const name = formString(form, `process.aiTools.${index}.name`);
        const model = formString(form, `process.aiTools.${index}.model`);
        const provider = formString(form, `process.aiTools.${index}.provider`);
        const purpose = formString(form, `process.aiTools.${index}.purpose`);
        if (!name && !model && !provider && !purpose) return null;
        return {
          name,
          model,
          provider,
          purpose,
          isPublic: formBool(form, `process.aiTools.${index}.isPublic`),
        };
      }),
      lyricsUsed: formBool(form, "process.lyricsUsed"),
      lyricsDetails: formString(form, "process.lyricsDetails"),
      voiceCloneUsed: formBool(form, "process.voiceCloneUsed"),
      voiceCloneDetails: formString(form, "process.voiceCloneDetails"),
      samplesUsed: formBool(form, "process.samplesUsed"),
      sampleDetails: formString(form, "process.sampleDetails"),
      sourceMaterialContext: formString(form, "process.sourceMaterialContext"),
      publicSummary: formString(form, "process.publicSummary"),
      privateNotes: formString(form, "process.privateNotes"),
    },
    provenance: {
      summary: formString(form, "provenance.summary"),
      publicNotes: formString(form, "provenance.publicNotes"),
      privateNotes: formString(form, "provenance.privateNotes"),
      steps: collectIndexed(form, 3, (index) => {
        const processType = formString(form, `provenance.steps.${index}.processType`);
        const description = formString(form, `provenance.steps.${index}.description`);
        if (!processType && !description) return null;
        return {
          position: index + 1,
          processType,
          description,
          occurredAt: formString(form, `provenance.steps.${index}.occurredAt`) || null,
        };
      }),
      sources: collectIndexed(form, 3, (index) => {
        const sourceType = formString(form, `provenance.sources.${index}.sourceType`);
        const reference = formString(form, `provenance.sources.${index}.reference`);
        if (!sourceType && !reference) return null;
        return {
          position: index + 1,
          sourceType:
            sourceType === "licensed_material" ||
            sourceType === "public_domain" ||
            sourceType === "generated_material" ||
            sourceType === "other"
              ? sourceType
              : "original_recording",
          reference,
          rightsContext: formString(form, `provenance.sources.${index}.rightsContext`) || null,
        };
      }),
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
      territories: [],
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
      territories: [],
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
  return {
    invitation,
    aggregate,
    initialDraft: aggregate
      ? {
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
        }
      : blankData(invitation.inviteeName, invitation.inviteeEmail),
    flash: flowMessage(new URL(request.url)),
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
    const declaration = parseEvidenceDeclaration({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
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

  const draft = readDraft(form);
  if (intent === "save-draft") {
    const result = await service.saveDraft(tokenHash, draft, abuseMeta);
    if (!result.ok) {
      return Response.json(
        { error: result.error.message },
        { status: submissionHttpStatus(result.error.code) },
      );
    }
    return redirect(`/submit/${params.invitationToken}?saved=1`);
  }
  if (intent === "submit") {
    const result = await service.submit(tokenHash, draft, abuseMeta);
    if (!result.ok) {
      return Response.json(
        { error: result.error.message },
        { status: submissionHttpStatus(result.error.code) },
      );
    }
    return redirect(`/submit/${params.invitationToken}?submitted=1`);
  }
  return Response.json({ error: "Unsupported submission action." }, { status: 400 });
}

function DraftInput({
  name,
  label,
  defaultValue = "",
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={defaultValue} />
    </label>
  );
}

function DraftTextArea({
  name,
  label,
  defaultValue = "",
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <textarea name={name} defaultValue={defaultValue} rows={4} />
    </label>
  );
}

export const meta: Route.MetaFunction = () => [
  { title: "Invitation submission | Sunstruck Synapse Radio" },
];

export default function SubmissionRoute() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<{ error?: string }>();
  const draft = data.initialDraft;
  const status = data.aggregate?.submission.status ?? "draft";

  return (
    <main className="entity-page submission-page">
      <p className="eyebrow">Invitation submission</p>
      <h1>Submit for curator review</h1>
      <p>
        Invitation: <strong>{data.invitation.publicReference}</strong>
        {data.aggregate ? (
          <>
            {" · "}Submission reference:{" "}
            <strong>{data.aggregate.submission.publicReference}</strong>
          </>
        ) : null}
      </p>
      <p>
        Review the <Link to="/submission-terms">submission terms</Link>,{" "}
        <Link to="/privacy">privacy notice</Link>, and{" "}
        <Link to="/takedown">content takedown process</Link>.
      </p>
      {data.flash ? <p role="status">{data.flash}</p> : null}
      {actionData?.error ? <p role="alert">{actionData.error}</p> : null}
      <Form method="post" className="curator-form">
        <input type="hidden" name="website" />
        <section>
          <h2>Intake</h2>
          <label>
            Submission kind
            <select name="submissionKind" defaultValue={draft.submissionKind}>
              <option value="track">Track</option>
              <option value="release">Release</option>
            </select>
          </label>
          <DraftInput name="workTitle" label="Work title" defaultValue={draft.workTitle} />
          <DraftInput
            name="artist.displayName"
            label="Artist display name"
            defaultValue={draft.artist.displayName}
          />
          <DraftTextArea
            name="artist.shortBiography"
            label="Artist biography"
            defaultValue={draft.artist.shortBiography}
          />
          <DraftInput
            name="artist.location"
            label="Location"
            defaultValue={draft.artist.location}
          />
          <DraftInput
            name="artist.websiteUrl"
            label="Website"
            defaultValue={draft.artist.websiteUrl}
          />
          <DraftInput
            name="artist.socialUrl"
            label="Social link"
            defaultValue={draft.artist.socialUrl}
          />
          <DraftTextArea
            name="artist.priorWorkNotes"
            label="Prior work / context"
            defaultValue={draft.artist.priorWorkNotes}
          />
          <DraftInput
            name="release.title"
            label="Release title"
            defaultValue={draft.release.title}
          />
          <DraftTextArea
            name="release.summary"
            label="Release summary"
            defaultValue={draft.release.summary}
          />
          <DraftInput
            name="release.plannedReleaseDate"
            label="Planned release date"
            defaultValue={draft.release.plannedReleaseDate}
            type="date"
          />
          <DraftInput name="track.title" label="Track title" defaultValue={draft.track.title} />
          <DraftInput
            name="track.versionTitle"
            label="Track version / mix"
            defaultValue={draft.track.versionTitle}
          />
          <DraftInput
            name="track.durationNotes"
            label="Duration / pacing notes"
            defaultValue={draft.track.durationNotes}
          />
          <label>
            <input
              type="checkbox"
              name="track.isLeadSingle"
              defaultChecked={draft.track.isLeadSingle}
            />
            Lead single
          </label>
          <label>
            <input
              type="checkbox"
              name="track.isInstrumental"
              defaultChecked={draft.track.isInstrumental}
            />
            Instrumental
          </label>
          <DraftTextArea
            name="track.lyricsSummary"
            label="Lyrics summary"
            defaultValue={draft.track.lyricsSummary}
          />
          <DraftInput
            name="contact.contactName"
            label="Contact name"
            defaultValue={draft.contact.contactName}
          />
          <DraftInput
            name="contact.contactEmail"
            label="Contact email"
            defaultValue={draft.contact.contactEmail}
            type="email"
          />
          <DraftInput
            name="contact.contactPhone"
            label="Contact phone"
            defaultValue={draft.contact.contactPhone}
          />
          <label>
            Preferred contact method
            <select
              name="contact.preferredContactMethod"
              defaultValue={draft.contact.preferredContactMethod}
            >
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </label>
        </section>
        <section>
          <h2>Rights</h2>
          <label>
            Authority basis
            <select name="rights.authorityBasis" defaultValue={draft.rights.authorityBasis}>
              <option value="original_author">Original author</option>
              <option value="licensed">Licensed</option>
              <option value="public_domain">Public domain</option>
              <option value="other">Other</option>
            </select>
          </label>
          <DraftTextArea
            name="rights.authorityDetails"
            label="Authority details"
            defaultValue={draft.rights.authorityDetails}
          />
          <DraftTextArea
            name="rights.entitlementStatement"
            label="Entitlement statement"
            defaultValue={draft.rights.entitlementStatement}
          />
          <DraftTextArea
            name="rights.publicSummary"
            label="Public rights summary"
            defaultValue={draft.rights.publicSummary}
          />
          <DraftTextArea
            name="rights.publicNotes"
            label="Public rights notes"
            defaultValue={draft.rights.publicNotes}
          />
          <DraftTextArea
            name="rights.privateNotes"
            label="Private rights notes"
            defaultValue={draft.rights.privateNotes}
          />
          <label>
            <input
              type="checkbox"
              name="rights.containsThirdPartyMaterial"
              defaultChecked={draft.rights.containsThirdPartyMaterial}
            />
            Includes third-party material
          </label>
          <DraftTextArea
            name="rights.thirdPartyMaterialDetails"
            label="Third-party material details"
            defaultValue={draft.rights.thirdPartyMaterialDetails}
          />
          <DraftInput
            name="rights.territories"
            label="Territories (comma separated)"
            defaultValue={draft.rights.territories.join(", ")}
          />
          <DraftInput
            name="rights.distributorName"
            label="Distributor"
            defaultValue={draft.rights.distributorName}
          />
          <DraftInput
            name="rights.distributorReleaseId"
            label="Distributor release ID"
            defaultValue={draft.rights.distributorReleaseId}
          />
          <DraftInput name="rights.isrc" label="ISRC" defaultValue={draft.rights.isrc} />
          <DraftTextArea
            name="rights.restrictions"
            label="Restrictions"
            defaultValue={draft.rights.restrictions}
          />
          <DraftTextArea
            name="rights.attestation"
            label="Submission attestation"
            defaultValue={draft.rights.attestation}
          />
        </section>
        <section>
          <h2>Creative process</h2>
          <label>
            <input type="checkbox" name="process.aiUsed" defaultChecked={draft.process.aiUsed} />
            AI tools were used
          </label>
          <DraftTextArea
            name="process.aiUseDescription"
            label="AI use description"
            defaultValue={draft.process.aiUseDescription}
          />
          <DraftTextArea
            name="process.meaningfulHumanContribution"
            label="Meaningful human contribution"
            defaultValue={draft.process.meaningfulHumanContribution}
          />
          <DraftInput
            name="process.toolsAndSystems"
            label="Tools and systems (comma separated)"
            defaultValue={draft.process.toolsAndSystems.join(", ")}
          />
          {[0, 1].map((index) => (
            <fieldset key={`human-role-${index}`}>
              <legend>Human role {index + 1}</legend>
              <DraftInput
                name={`process.humanRoles.${index}.name`}
                label="Name"
                defaultValue={draft.process.humanRoles[index]?.name ?? ""}
              />
              <DraftInput
                name={`process.humanRoles.${index}.role`}
                label="Role"
                defaultValue={draft.process.humanRoles[index]?.role ?? ""}
              />
              <DraftTextArea
                name={`process.humanRoles.${index}.contribution`}
                label="Contribution"
                defaultValue={draft.process.humanRoles[index]?.contribution ?? ""}
              />
            </fieldset>
          ))}
          {[0, 1].map((index) => (
            <fieldset key={`ai-tool-${index}`}>
              <legend>AI tool {index + 1}</legend>
              <DraftInput
                name={`process.aiTools.${index}.name`}
                label="Tool"
                defaultValue={draft.process.aiTools[index]?.name ?? ""}
              />
              <DraftInput
                name={`process.aiTools.${index}.model`}
                label="Model"
                defaultValue={draft.process.aiTools[index]?.model ?? ""}
              />
              <DraftInput
                name={`process.aiTools.${index}.provider`}
                label="Provider"
                defaultValue={draft.process.aiTools[index]?.provider ?? ""}
              />
              <DraftInput
                name={`process.aiTools.${index}.purpose`}
                label="Purpose"
                defaultValue={draft.process.aiTools[index]?.purpose ?? ""}
              />
            </fieldset>
          ))}
          <label>
            <input
              type="checkbox"
              name="process.lyricsUsed"
              defaultChecked={draft.process.lyricsUsed}
            />
            Lyrics involved
          </label>
          <DraftTextArea
            name="process.lyricsDetails"
            label="Lyrics details"
            defaultValue={draft.process.lyricsDetails}
          />
          <label>
            <input
              type="checkbox"
              name="process.voiceCloneUsed"
              defaultChecked={draft.process.voiceCloneUsed}
            />
            Voice clone used
          </label>
          <DraftTextArea
            name="process.voiceCloneDetails"
            label="Voice clone details"
            defaultValue={draft.process.voiceCloneDetails}
          />
          <label>
            <input
              type="checkbox"
              name="process.samplesUsed"
              defaultChecked={draft.process.samplesUsed}
            />
            Samples / source material used
          </label>
          <DraftTextArea
            name="process.sampleDetails"
            label="Samples / source details"
            defaultValue={draft.process.sampleDetails}
          />
          <DraftTextArea
            name="process.sourceMaterialContext"
            label="Source material context"
            defaultValue={draft.process.sourceMaterialContext}
          />
          <DraftTextArea
            name="process.publicSummary"
            label="Public process summary"
            defaultValue={draft.process.publicSummary}
          />
          <DraftTextArea
            name="process.privateNotes"
            label="Private process notes"
            defaultValue={draft.process.privateNotes}
          />
        </section>
        <section>
          <h2>Provenance</h2>
          <DraftTextArea
            name="provenance.summary"
            label="Summary"
            defaultValue={draft.provenance.summary}
          />
          <DraftTextArea
            name="provenance.publicNotes"
            label="Public provenance notes"
            defaultValue={draft.provenance.publicNotes}
          />
          <DraftTextArea
            name="provenance.privateNotes"
            label="Private provenance notes"
            defaultValue={draft.provenance.privateNotes}
          />
          {[0, 1, 2].map((index) => (
            <fieldset key={`prov-step-${index}`}>
              <legend>Process step {index + 1}</legend>
              <DraftInput
                name={`provenance.steps.${index}.processType`}
                label="Type"
                defaultValue={draft.provenance.steps[index]?.processType ?? ""}
              />
              <DraftTextArea
                name={`provenance.steps.${index}.description`}
                label="Description"
                defaultValue={draft.provenance.steps[index]?.description ?? ""}
              />
              <DraftInput
                name={`provenance.steps.${index}.occurredAt`}
                label="Occurred at"
                defaultValue={draft.provenance.steps[index]?.occurredAt ?? ""}
                type="date"
              />
            </fieldset>
          ))}
          {[0, 1, 2].map((index) => (
            <fieldset key={`prov-source-${index}`}>
              <legend>Source {index + 1}</legend>
              <label>
                Source type
                <select
                  name={`provenance.sources.${index}.sourceType`}
                  defaultValue={draft.provenance.sources[index]?.sourceType ?? "original_recording"}
                >
                  <option value="original_recording">Original recording</option>
                  <option value="licensed_material">Licensed material</option>
                  <option value="public_domain">Public domain</option>
                  <option value="generated_material">Generated material</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <DraftInput
                name={`provenance.sources.${index}.reference`}
                label="Reference"
                defaultValue={draft.provenance.sources[index]?.reference ?? ""}
              />
              <DraftTextArea
                name={`provenance.sources.${index}.rightsContext`}
                label="Rights context"
                defaultValue={draft.provenance.sources[index]?.rightsContext ?? ""}
              />
            </fieldset>
          ))}
        </section>
        <section>
          <h2>Acknowledgements</h2>
          {[
            [
              "ack.invitationConfirmed",
              "This invitation is mine to use.",
              draft.acknowledgements.invitationConfirmed,
            ],
            [
              "ack.accuracyConfirmed",
              "The submission is accurate to the best of my knowledge.",
              draft.acknowledgements.accuracyConfirmed,
            ],
            [
              "ack.rightsConfirmed",
              "I can support the rights declaration on request.",
              draft.acknowledgements.rightsConfirmed,
            ],
            [
              "ack.disclosureConfirmed",
              "The creative-process disclosure is complete.",
              draft.acknowledgements.disclosureConfirmed,
            ],
            [
              "ack.reviewProcessConfirmed",
              "I understand that review and publication are separate decisions.",
              draft.acknowledgements.reviewProcessConfirmed,
            ],
          ].map(([name, label, checked]) => (
            <label key={String(name)}>
              <input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} />
              {label}
            </label>
          ))}
        </section>
        <div className="curator-actions">
          <button type="submit" name="intent" value="save-draft">
            Save draft
          </button>
          <button type="submit" name="intent" value="submit">
            Submit for review
          </button>
        </div>
      </Form>

      <section>
        <h2>Private evidence</h2>
        <p>
          Upload only files needed for curator review. Evidence stays private, is reviewed manually
          for malware status, and is never shown on public pages.
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
        {data.aggregate?.evidence.length ? (
          <ul>
            {data.aggregate.evidence.map((evidence) => (
              <li key={evidence.id}>
                {evidence.originalFilename} · {evidence.mimeType} · {evidence.byteSize} bytes ·{" "}
                {evidence.malwareStatus}
              </li>
            ))}
          </ul>
        ) : (
          <p>No evidence uploaded yet.</p>
        )}
      </section>

      <section>
        <h2>Withdrawal</h2>
        <Form method="post" className="curator-form">
          <input type="hidden" name="intent" value="withdraw" />
          <DraftTextArea name="withdrawMessage" label="Withdrawal note" />
          <button type="submit" disabled={status === "accepted" || status === "rejected"}>
            Withdraw submission
          </button>
        </Form>
      </section>
    </main>
  );
}
