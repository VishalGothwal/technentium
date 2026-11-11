"use server";
import { runAction } from "@/server/actions";
import { assignDevices, deleteDevice3dModel, finishGlbUpload, generateDefaultModels, removeGlb, saveDevice3dModel, startGlbUpload } from "@/server/modules/catalog/device-3d-admin.service";

export const saveDevice3dAction = async (id: string | null, input: unknown) => runAction((a) => saveDevice3dModel(a, id, input));
export const deleteDevice3dAction = async (id: string) => runAction((a) => deleteDevice3dModel(a, id));
export const assignDevicesAction = async (id: string, add: string[], remove: string[]) => runAction((a) => assignDevices(a, id, { add, remove }));
export const generateDefaultsAction = async () => runAction((a) => generateDefaultModels(a));
export const startGlbUploadAction = async (id: string, size: number) => runAction((a) => startGlbUpload(a, id, size), { refresh: false });
export const finishGlbUploadAction = async (id: string, key: string) => runAction((a) => finishGlbUpload(a, id, key));
export const removeGlbAction = async (id: string) => runAction((a) => removeGlb(a, id));
