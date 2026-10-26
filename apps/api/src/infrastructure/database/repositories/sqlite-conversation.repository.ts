import { Injectable, Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { conversations as convTable, messages as msgTable } from '../schema';
import { Conversation, ConversationContext } from '../../../domain/conversation/conversation.entity';
import { ConversationState } from '../../../domain/conversation/conversation-fsm';
import {
  IConversationRepository,
  IMessageRepository,
} from '../../../domain/conversation/repositories';
import { DB_TOKEN } from '../database.tokens';

@Injectable()
export class SqliteConversationRepository implements IConversationRepository {
  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async findById(id: string): Promise<Conversation | null> {
    const rows = await this.db.select().from(convTable).where(eq(convTable.id, id)).limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByChannelExternalId(channel: string, externalId: string): Promise<Conversation | null> {
    const rows = await this.db
      .select()
      .from(convTable)
      .where(and(eq(convTable.channel, channel), eq(convTable.externalId, externalId)))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findActiveByExternalId(externalId: string): Promise<Conversation | null> {
    const rows = await this.db
      .select()
      .from(convTable)
      .where(eq(convTable.externalId, externalId))
      .orderBy(desc(convTable.updatedAt))
      .limit(1);
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async list(opts?: { limit?: number; offset?: number }): Promise<Conversation[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const rows = await this.db.select().from(convTable).limit(limit).offset(offset);
    return rows.map((r: any) => this.toDomain(r));
  }

  async save(conversation: Conversation): Promise<void> {
    const row = this.toRow(conversation);
    await this.db.insert(convTable).values(row).onConflictDoUpdate({
      target: convTable.id,
      set: {
        state: row.state,
        context: row.context,
        metadata: row.metadata,
        updatedAt: row.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(convTable).where(eq(convTable.id, id));
  }

  private toDomain(r: any): Conversation {
    const ctx: ConversationContext = {
      conversationId: r.id,
      channel: r.channel,
      externalId: r.externalId,
      history: r.context?.history ?? [],
      ...(r.context ?? {}),
    };
    return Conversation.reconstitute({
      id: r.id,
      channel: r.channel,
      externalId: r.externalId,
      state: r.state as ConversationState,
      context: ctx,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      metadata: r.metadata,
    });
  }

  private toRow(c: Conversation): any {
    return {
      id: c.id,
      channel: c.channel,
      externalId: c.externalId,
      state: c.state,
      context: c.context,
      metadata: c.metadata,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}

@Injectable()
export class SqliteMessageRepository implements IMessageRepository {
  constructor(@Inject(DB_TOKEN) private readonly conn: any) {}
  private get db() {
    return this.conn.db;
  }

  async append(args: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolName?: string;
    toolResult?: unknown;
    tokens?: number;
  }): Promise<void> {
    await this.db.insert(msgTable).values({
      id: require('uuid').v7(),
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      toolName: args.toolName,
      toolResult: args.toolResult as any,
      tokens: args.tokens,
      at: new Date(),
    });
  }

  async recent(conversationId: string, limit = 50) {
    const rows = await this.db
      .select()
      .from(msgTable)
      .where(eq(msgTable.conversationId, conversationId))
      .orderBy(desc(msgTable.at))
      .limit(limit);
    return rows.reverse().map((r: any) => ({
      role: r.role,
      content: r.content,
      toolName: r.toolName,
      toolResult: r.toolResult,
      tokens: r.tokens,
      at: r.at,
    }));
  }
}
