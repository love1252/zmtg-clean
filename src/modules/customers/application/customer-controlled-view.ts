
import type {
  CustomerLifecycle,
  CustomerPriority,
} from '@/modules/customers/application/customer-command-service';

export type CustomerControlledDtoV1 = Readonly<{
  contractVersion: 'v1';
  customerId: string;
  displayName: string;
  lifecycle: CustomerLifecycle;
  priority: CustomerPriority;
  ownerUserId: string;
  projectInterest: string;
  updatedAt: string;
  permissions: Readonly<{
    canUpdate: boolean;
    canReassignOwner: boolean;
  }>;
}>;
