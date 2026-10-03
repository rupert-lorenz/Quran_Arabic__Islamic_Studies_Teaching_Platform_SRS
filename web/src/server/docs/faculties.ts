import { dataStores, designRules, platformModules } from "@/server/architecture";
import {
  apiSurface,
  deploymentState,
  docIds,
  integrationRows,
  sectionCount,
  tableCount,
} from "@/server/docs/content";
import {
  trainingCourses,
  trainingSectionCount,
} from "@/server/docs/training";

const roleGuides = ["teacher", "student", "parent"] as const;

export function getDocumentationFaculties() {
  const deployment = deploymentState();
  const api = apiSurface();
  const channels = integrationRows();

  return {
    documents: docIds
      .filter((id) => id !== "overview")
      .map((id) => ({
        id,
        sections: sectionCount(id),
        href: roleGuides.includes(id as (typeof roleGuides)[number])
          ? id === "teacher"
            ? "/teach/guide"
            : id === "student"
              ? "/learn/guide"
              : "/family/guide"
          : `/staff/docs/${id}`,
        staffHref: `/staff/docs/${id}` as const,
      })),
    overview: { sections: sectionCount("overview"), documents: docIds.length - 1 },
    architecture: {
      modules: platformModules.length,
      rules: designRules.length,
      stores: dataStores.length,
      sections: sectionCount("architecture"),
    },
    database: {
      modules: platformModules.length,
      tables: tableCount(),
      rows: platformModules.map((module) => ({
        id: module.key,
        tables: module.tables.length,
      })),
      sections: sectionCount("database"),
    },
    api: {
      routes: api.routes,
      areas: api.areas.length,
      sections: sectionCount("api"),
    },
    integration: {
      connected: channels.filter((row) => row.on).length,
      listed: channels.length,
      rows: channels,
      sections: sectionCount("integration"),
    },
    deployment: {
      ...deployment,
      sections: sectionCount("deployment"),
    },
    guides: {
      admin: sectionCount("admin"),
      teacher: sectionCount("teacher"),
      student: sectionCount("student"),
      parent: sectionCount("parent"),
    },
    source: {
      apps: 2,
      sections: sectionCount("source"),
    },
    training: trainingCourses.map((course) => ({
      id: course.id,
      slug: course.slug,
      href: `/staff/training/${course.slug}`,
      sections: trainingSectionCount(course.id),
    })),
  };
}

export type DocumentationFaculties = ReturnType<typeof getDocumentationFaculties>;
