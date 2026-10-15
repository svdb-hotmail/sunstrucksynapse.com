import type { SubmissionDraftInput } from "../../app/repositories/submissions.server";
// Deterministic synthetic records for isolated verification only.
export function releaseSubmissionFixture(n: number) {
  return `
      insert into submission_invitations (
        id, public_reference, token_hash, invitee_name, invitee_email, expires_at
      ) values (
        '10000000-0000-4000-8000-000000000001', 'INV-CURATION-001', repeat('a', 64),
        'New Signal', 'artist@example.test', '2030-01-01T00:00:00Z'
      );
      insert into submissions (
        id, invitation_id, public_reference, invitation_reference, submitter_name,
        submitter_email, title, artist_details, status, submitted_at, reviewed_at,
        assigned_curator_id, assigned_curator_email, assigned_at
      ) values (
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001', 'SUB-CURATION-001', 'INV-CURATION-001',
        'New Signal', 'artist@example.test', 'Unwritten Frequency',
        '{"displayName":"New Signal","shortBiography":"Human-directed radio music."}'::jsonb,
        'listening', '2026-09-07T10:00:00Z', '2026-09-07T10:05:00Z',
        'curator-1', 'curator@example.test', '2026-09-07T10:05:00Z'
      );
      insert into rights_declarations (
        id, submission_id, version, revision_author_name, revision_author_email,
        revision_reason, authority_basis, entitlement_statement, public_summary,
        territories
      ) values (
        '30000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', 1, 'New Signal',
        'artist@example.test', 'Submitted', 'original_author', 'I control these rights.',
        'Original composition.', array['Worldwide']
      );
      update rights_declarations set status = 'attested', attestation = 'Accurate',
        attested_at = '2026-09-07T10:00:00Z'
      where id = '30000000-0000-4000-8000-000000000001';
      insert into creative_process_disclosures (
        id, submission_id, version, revision_author_name, revision_author_email,
        revision_reason, ai_used, meaningful_human_contribution, human_roles,
        artist_summary
      ) values (
        '40000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', 1, 'New Signal',
        'artist@example.test', 'Submitted', false, 'Composition and final production.',
        '[{"name":"New Signal","role":"artist","contribution":"composition"}]'::jsonb,
        'Human-composed and produced.'
      );
      update creative_process_disclosures set status = 'finalized',
        finalized_at = '2026-09-07T10:00:00Z'
      where id = '40000000-0000-4000-8000-000000000001';
      insert into provenance_records (
        id, submission_id, version, revision_author_name, revision_author_email,
        revision_reason, summary
      ) values (
        '50000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001', 1, 'New Signal',
        'artist@example.test', 'Submitted', 'Recorded and mixed by the artist.'
      );
      update provenance_records set status = 'finalized', finalized_at = '2026-09-07T10:00:00Z'
      where id = '50000000-0000-4000-8000-000000000001';
      insert into submission_audio_upload_sessions (
        id, submission_id, staging_object_key, original_filename, mime_type,
        checksum_sha256, byte_size, duration_ms, codec, status, expires_at, completed_at
      ) values (
        '60000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        'private/review-audio/staging/60000000-0000-4000-8000-000000000001',
        'signal.flac', 'audio/flac', repeat('b', 64), 4096, 180000, 'flac',
        'completed', '2026-09-07T11:00:00Z', '2026-09-07T10:10:00Z'
      );
      insert into submission_review_audio (
        id, submission_id, upload_session_id, version, object_key, original_filename,
        mime_type, checksum_sha256, byte_size, duration_ms, codec, finalized_at
      ) values (
        '70000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '60000000-0000-4000-8000-000000000001', 1,
        'private/review-audio/final/20000000-0000-4000-8000-000000000001/signal',
        'signal.flac', 'audio/flac', repeat('b', 64), 4096, 180000, 'flac',
        '2026-09-07T10:10:00Z'
      );
      insert into submission_review_audio_selections (submission_id, audio_id) values (
        '20000000-0000-4000-8000-000000000001',
        '70000000-0000-4000-8000-000000000001'
      );
`
    .replaceAll("000000000001", String(n).padStart(12, "0"))
    .replaceAll("CURATION-001", `CURATION-${String(n).padStart(3, "0")}`)
    .replaceAll("repeat('a', 64)", `repeat('${n.toString(16)}', 64)`);
}

export function completeDraft(overrides: Partial<SubmissionDraftInput> = {}): SubmissionDraftInput {
  return {
    submissionKind: "track",
    workTitle: "Orbit Glass",
    artist: {
      displayName: "Invited Artist",
      shortBiography: "Producer and songwriter.",
      location: "Berlin",
      websiteUrl: "https://artist.example.test",
      socialUrl: "",
      priorWorkNotes: "",
    },
    release: {
      title: "Orbit Glass EP",
      summary: "A compact release for review.",
      plannedReleaseDate: "2026-10-01",
      labelName: "",
      distributorName: "Independent",
      distributorReleaseId: "ORBIT-001",
      territories: ["Worldwide"],
    },
    track: {
      title: "Orbit Glass",
      versionTitle: "",
      durationNotes: "Approx. four minutes.",
      isLeadSingle: true,
      lyricsSummary: "",
      isInstrumental: false,
    },
    contact: {
      contactName: "Invited Artist",
      contactEmail: "invited@example.test",
      contactPhone: "",
      preferredContactMethod: "email",
    },
    acknowledgements: {
      invitationConfirmed: true,
      accuracyConfirmed: true,
      rightsConfirmed: true,
      disclosureConfirmed: true,
      reviewProcessConfirmed: true,
    },
    rights: {
      authorityBasis: "original_author",
      authorityDetails: "",
      entitlementStatement: "I control the rights needed for review and publication.",
      publicSummary: "Original work created and controlled by the submitter.",
      publicNotes: "",
      privateNotes: "",
      containsThirdPartyMaterial: false,
      thirdPartyMaterialDetails: "",
      restrictions: "",
      territories: ["Worldwide"],
      distributorName: "Independent",
      distributorReleaseId: "ORBIT-001",
      isrc: "GBABC2600099",
      attestation: "I attest that this declaration is accurate.",
    },
    process: {
      aiUsed: true,
      aiUseDescription: "AI ideation informed arrangement sketches.",
      meaningfulHumanContribution: "Human composition, editing, and mix decisions.",
      toolsAndSystems: ["Sketcher"],
      humanRoles: [
        {
          name: "Invited Artist",
          role: "artist",
          contribution: "Composition and production",
          isPublic: true,
        },
      ],
      aiTools: [
        {
          name: "Sketcher",
          model: "v2",
          provider: "Example",
          purpose: "Ideation",
          isPublic: true,
        },
      ],
      lyricsUsed: false,
      lyricsDetails: "",
      voiceCloneUsed: false,
      voiceCloneDetails: "",
      samplesUsed: false,
      sampleDetails: "",
      sourceMaterialContext: "",
      publicSummary: "AI supported ideation while the artist directed the finished work.",
      privateNotes: "",
    },
    provenance: {
      summary: "Source sketches were reviewed and rebuilt by the artist.",
      publicNotes: "Evidence remains private.",
      privateNotes: "",
      steps: [
        {
          position: 1,
          processType: "arrangement",
          description: "The artist rebuilt the arrangement from sketches.",
          occurredAt: null,
        },
      ],
      sources: [
        {
          position: 1,
          sourceType: "generated_material",
          reference: "Sketch-001",
          rightsContext: "Internal ideation asset.",
        },
      ],
    },
    ...overrides,
  };
}
