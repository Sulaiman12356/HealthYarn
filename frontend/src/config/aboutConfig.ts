import rawConfig from "./about.config.json";

export interface AboutTeamMember {
  name: string;
  role: string;
  contribution: string;
  photo?: string;
}

export interface AboutReviewer {
  name: string;
  profession: string;
  reviewed: string;
  date?: string;
}

export interface AboutConfig {
  team: AboutTeamMember[];
  reviewers: AboutReviewer[];
  institution: string;
  sttProvider: string;
  contactEmail: string;
  contentLastReviewed: string;
  licensesRepoUrl: string;
}

function cleanStr(val: unknown): string {
  return typeof val === "string" ? val.trim() : "";
}

export function normalizeAboutConfig(input: Partial<AboutConfig>): AboutConfig {
  const team = Array.isArray(input.team)
    ? input.team
        .filter((m) => cleanStr(m?.name) !== "")
        .map((m) => ({
          name: cleanStr(m.name),
          role: cleanStr(m.role),
          contribution: cleanStr(m.contribution),
          photo: cleanStr(m.photo) || undefined
        }))
    : [];

  const reviewers = Array.isArray(input.reviewers)
    ? input.reviewers
        .filter((r) => cleanStr(r?.name) !== "")
        .map((r) => ({
          name: cleanStr(r.name),
          profession: cleanStr(r.profession),
          reviewed: cleanStr(r.reviewed),
          date: cleanStr(r.date) || undefined
        }))
    : [];

  return {
    team,
    reviewers,
    institution: cleanStr(input.institution),
    sttProvider: cleanStr(input.sttProvider),
    contactEmail: cleanStr(input.contactEmail),
    contentLastReviewed: cleanStr(input.contentLastReviewed),
    licensesRepoUrl: cleanStr(input.licensesRepoUrl)
  };
}

export const ABOUT_CONFIG: AboutConfig = normalizeAboutConfig(rawConfig as Partial<AboutConfig>);

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
