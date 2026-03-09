import type { Client } from "@connectrpc/connect";
import type { ChannelService } from "../gen/outbox/v1/channel_pb.js";
import { mapChannel } from "../internal/mappers.js";
import { channelName } from "../internal/resource-names.js";
import type { Channel } from "../types.js";

export interface ListChannelsInput {
  pageSize?: number;
  pageToken?: string;
}

export interface ListChannelsResult {
  items: Channel[];
  nextPageToken?: string;
  totalSize: number;
}

export class ChannelsNamespace {
  readonly #client: Client<typeof ChannelService>;

  constructor(client: Client<typeof ChannelService>) {
    this.#client = client;
  }

  async get(id: string): Promise<Channel> {
    const res = await this.#client.getChannel({ name: channelName(id) });
    if (!res.channel) {
      throw new Error("getChannel: server returned an empty channel");
    }
    return mapChannel(res.channel);
  }

  async list(input: ListChannelsInput = {}): Promise<ListChannelsResult> {
    const res = await this.#client.listChannels(input);
    return {
      items: res.channels.map(mapChannel),
      nextPageToken: res.nextPageToken || undefined,
      totalSize: Number(res.totalSize),
    };
  }
}
