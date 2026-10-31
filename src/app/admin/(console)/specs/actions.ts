"use server";
import { runAction } from "@/server/actions";
import { saveComparison, saveSpec, setComparisonStatus, setSpecStatus } from "@/server/modules/content/specs.admin";

/** Thin wrappers; the specs service enforces content.edit / content.publish. */
export const saveSpecAction = async (id: string | null, input: unknown) => runAction((actor) => saveSpec(actor, id, input));
export const specStatusAction = async (id: string, input: unknown) => runAction((actor) => setSpecStatus(actor, id, input));
export const saveComparisonAction = async (id: string | null, input: unknown) => runAction((actor) => saveComparison(actor, id, input));
export const comparisonStatusAction = async (id: string, input: unknown) => runAction((actor) => setComparisonStatus(actor, id, input));
