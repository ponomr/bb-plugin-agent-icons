export const MAX_FILE_BYTES = 32 * 1024;
export const MAX_ICONS_PER_SET = 200;
export const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
/** bb rejects KV values larger than this. */
export const KV_VALUE_MAX_BYTES = 256 * 1024;
/** Upload batch size from the client; bb accepts RPC bodies of 4 MB. */
export const UPLOAD_BATCH_BYTES = 1024 * 1024;

export const MAX_TREE_DEPTH = 32;
export const MAX_TREE_NODES = 2000;
