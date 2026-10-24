import { Module } from '@nestjs/common';
import { IdentityGrpcController } from './controllers/identity.grpc.controller.js';
import { PeopleController } from './controllers/people.controller.js';
import { PeopleRepository } from './repository/people.repository.js';
import { PeopleService } from './services/people.service.js';

@Module({
  controllers: [PeopleController, IdentityGrpcController],
  providers: [PeopleService, PeopleRepository],
})
export class PeopleModule {}
