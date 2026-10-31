"use server";
import { runAction } from "@/server/actions";
import { createContent, restoreRevision, searchRelationTargets, setPublishState, updateContent } from "@/server/modules/content/content.admin";

/** Thin wrappers; the content service enforces content.edit / content.publish. */
export const createContentAction = async (input: unknown) => runAction((actor) => createContent(actor, input));
export const updateContentAction = async (id: string, input: unknown) => runAction((actor) => updateContent(actor, id, input));
export const publishContentAction = async (id: string, input: unknown) => runAction((actor) => setPublishState(actor, id, input));
export const restoreRevisionAction = async (revisionId: string) => runAction((actor) => restoreRevision(actor, revisionId));
export const searchRelationsAction = async (q: string) => runAction((actor) => searchRelationTargets(actor, String(q).slice(0, 80)), { refresh: false });
