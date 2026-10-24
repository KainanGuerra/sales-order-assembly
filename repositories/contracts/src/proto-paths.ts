import { fileURLToPath } from 'node:url';

// Nest's gRPC transport loads the .proto at runtime even though the types are
// generated, so services need the file location. Resolved from the built
// output (dist/src) back to the proto folder that ships with this package.
const protoDir = (relative: string) =>
  fileURLToPath(new URL(`../../proto/${relative}`, import.meta.url));

export const CATALOG_PROTO_PATH = protoDir('sales/catalog/v1/catalog.proto');
export const IDENTITY_PROTO_PATH = protoDir('sales/identity/v1/identity.proto');
