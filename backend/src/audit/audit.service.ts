import { AuditLogModel } from '../database/models';
import { Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../database/schemas/audit-log.schema';

export class AuditService {
  private readonly auditLogModel = AuditLogModel;

  async log(
    actorId: string | null,
    action: string,
    entity: string,
    entityId: string,
    metadata?: any,
    ipAddress?: string,
  ) {
    const logEntry = new this.auditLogModel({
      actorId: actorId ? new Types.ObjectId(actorId) : undefined,
      action,
      entity,
      entityId,
      metadata,
      ipAddress,
    });
    await logEntry.save();
    return logEntry.toObject();
  }

  async findAll(limit = 100) {
    const list = await this.auditLogModel
      .find()
      .populate('actorId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return list.map((l: any) => ({
      ...l,
      id: l._id.toString(),
      actor: l.actorId
        ? {
            id: l.actorId._id?.toString(),
            firstName: l.actorId.firstName,
            lastName: l.actorId.lastName,
            email: l.actorId.email,
          }
        : null,
    }));
  }
}

export const auditService = new AuditService();
