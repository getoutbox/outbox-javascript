import type { Client } from "@connectrpc/connect";
import type { TemplateService } from "../gen/outbox/v1/template_pb.js";
import { mapTemplate } from "../internal/mappers.js";
import { templateName, templateParent } from "../internal/resource-names.js";
import type { Template, TemplateCategory } from "../types.js";

export interface ListTemplatesResult {
  items: Template[];
  nextPageToken?: string;
  totalSize: number;
}

export interface CreateTemplateInput {
  category: TemplateCategory;
  componentsJson: string;
  language: string;
  templateName: string;
}

export interface ListTemplatesOptions {
  pageSize?: number;
  pageToken?: string;
}

export class TemplatesNamespace {
  readonly #client: Client<typeof TemplateService>;

  constructor(client: Client<typeof TemplateService>) {
    this.#client = client;
  }

  async create(
    connectorId: string,
    input: CreateTemplateInput
  ): Promise<Template> {
    const res = await this.#client.createTemplate({
      parent: templateParent(connectorId),
      template: {
        templateName: input.templateName,
        language: input.language,
        category: input.category,
        componentsJson: input.componentsJson,
      },
    });
    if (!res.template) {
      throw new Error("createTemplate: server returned empty template");
    }
    return mapTemplate(res.template);
  }

  async get(connectorId: string, id: string): Promise<Template> {
    const res = await this.#client.getTemplate({
      name: templateName(connectorId, id),
    });
    if (!res.template) {
      throw new Error("getTemplate: server returned empty template");
    }
    return mapTemplate(res.template);
  }

  async list(
    connectorId: string,
    opts?: ListTemplatesOptions
  ): Promise<ListTemplatesResult> {
    const res = await this.#client.listTemplates({
      parent: templateParent(connectorId),
      ...opts,
    });
    return {
      items: res.templates.map(mapTemplate),
      nextPageToken: res.nextPageToken || undefined,
      totalSize: Number(res.totalSize),
    };
  }

  async delete(connectorId: string, id: string): Promise<void> {
    await this.#client.deleteTemplate({
      name: templateName(connectorId, id),
    });
  }
}
