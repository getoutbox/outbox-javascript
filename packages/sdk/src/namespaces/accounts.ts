import type { Client } from "@connectrpc/connect";
import type {
  AccountService,
  Account as ProtoAccount,
} from "../gen/outbox/v1/account_pb.js";
import { deriveFieldMask } from "../internal/field-mask.js";
import { mapAccount } from "../internal/mappers.js";
import { accountName } from "../internal/resource-names.js";
import type { Account } from "../types.js";

function assertAccount(
  value: ProtoAccount | undefined,
  operation: string
): ProtoAccount {
  if (!value) {
    throw new Error(`${operation}: server returned empty account`);
  }
  return value;
}

export interface CreateAccountInput {
  contactId?: string;
  externalId: string;
  metadata?: Record<string, string>;
  requestId?: string;
}

export interface ClaimAccountInput {
  contactId: string;
  id: string;
  requestId?: string;
}

export interface ListAccountsInput {
  filter?: string;
  orderBy?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface ListAccountsResult {
  items: Account[];
  nextPageToken?: string;
  totalSize: number;
}

export interface UpdateAccountInput {
  id: string;
  metadata?: Record<string, string>;
}

export class AccountsNamespace {
  readonly #client: Client<typeof AccountService>;

  constructor(client: Client<typeof AccountService>) {
    this.#client = client;
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const { requestId, ...fields } = input;
    const res = await this.#client.createAccount({
      account: fields,
      requestId,
    });
    return mapAccount(assertAccount(res.account, "create"));
  }

  async get(id: string): Promise<Account> {
    const res = await this.#client.getAccount({ name: accountName(id) });
    return mapAccount(assertAccount(res.account, "get"));
  }

  async list(input: ListAccountsInput = {}): Promise<ListAccountsResult> {
    const res = await this.#client.listAccounts(input);
    return {
      items: res.accounts.map(mapAccount),
      nextPageToken: res.nextPageToken || undefined,
      totalSize: Number(res.totalSize),
    };
  }

  async update(input: UpdateAccountInput): Promise<Account> {
    const { id, ...fields } = input;
    const res = await this.#client.updateAccount({
      account: { name: accountName(id), ...fields },
      updateMask: deriveFieldMask(fields),
    });
    return mapAccount(assertAccount(res.account, "update"));
  }

  async delete(id: string): Promise<void> {
    await this.#client.deleteAccount({ name: accountName(id) });
  }

  async resolve(externalId: string): Promise<Account> {
    const res = await this.#client.resolveAccount({ externalId });
    return mapAccount(assertAccount(res.account, "resolve"));
  }

  async claim(input: ClaimAccountInput): Promise<Account> {
    const { id, contactId, requestId } = input;
    const res = await this.#client.claimAccount({
      name: accountName(id),
      contactId,
      requestId,
    });
    return mapAccount(assertAccount(res.account, "claim"));
  }
}
