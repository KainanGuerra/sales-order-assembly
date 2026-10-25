import { status, type Metadata } from '@grpc/grpc-js';
import { Metadata as GrpcMetadata } from '@grpc/grpc-js';
import { ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom, timeout, type Observable } from 'rxjs';

export function innerAuthMetadata(secret: string): Metadata {
  const metadata = new GrpcMetadata();
  metadata.set('x-inner-auth', secret);
  return metadata;
}

// Runs one gRPC call under a deadline. NOT_FOUND becomes null (the caller
// decides what a missing entity means); anything else that is not a verdict
// from the other service is "unavailable, try again", never a 500.
export async function callUpstream<T>(name: string, call: Observable<T>, timeoutMs: number): Promise<T | null> {
  try {
    return await firstValueFrom(call.pipe(timeout(timeoutMs)));
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === status.NOT_FOUND) {
      return null;
    }
    throw new ServiceUnavailableException(`${name} is unavailable, try again shortly`);
  }
}
