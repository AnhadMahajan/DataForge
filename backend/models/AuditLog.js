/**
 * DataForge — AuditLog Model & Compliance Schema
 * Architecture: MVC Model Layer (Assigned to: Person 4 / Export, Audit & Telemetry)
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      uppercase: true,
      index: true,
      // Standardized audit actions include:
      // 'DATASET_UPLOAD', 'DATASET_DELETE', 'SYNTHESIS_RUN', 
      // 'EVALUATION_AUDIT', 'TSTR_BENCHMARK', 'EXPORT',
      // 'EXPORT_CSV', 'EXPORT_JSON', 'EXPORT_SQL',
      // 'USER_REGISTER', 'USER_LOGIN', 'SYSTEM_HEALTH'
    },
    resourceId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'WARNING'],
      default: 'SUCCESS',
      uppercase: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes for compliance audit reporting & timeline filtering
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ resourceId: 1, timestamp: -1 });

/**
 * Static helper method to record an audit log event safely.
 * Non-blocking: will catch DB write failures and warn rather than crashing client requests.
 *
 * @param {Object} params
 * @param {Object} [params.req] - Express request object (extracts IP, User-Agent, user)
 * @param {string} [params.user] - User ID override
 * @param {string} params.action - Action identifier (e.g. 'EXPORT', 'SYNTHESIS_RUN')
 * @param {string} [params.resourceId] - Target resource ID
 * @param {string} [params.ipAddress] - IP address override
 * @param {string} [params.userAgent] - User agent override
 * @param {string} [params.status] - 'SUCCESS', 'FAILURE', or 'WARNING'
 * @param {Object} [params.details] - Arbitrary JSON payload metadata
 * @returns {Promise<Document|null>}
 */
auditLogSchema.statics.record = async function (params = {}) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    const {
      req,
      user = req?.user?._id || null,
      action,
      resourceId = null,
      status = 'SUCCESS',
      details = {},
    } = params;

    const ipAddress =
      params.ipAddress ||
      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      '127.0.0.1';

    const userAgent =
      params.userAgent ||
      req?.headers?.['user-agent'] ||
      'DataForge-Client';

    const logEntry = await this.create({
      user,
      action: (action || 'SYSTEM_ACTION').toUpperCase(),
      resourceId: resourceId ? String(resourceId) : null,
      ipAddress,
      userAgent,
      status: String(status).toUpperCase(),
      details,
      timestamp: new Date(),
    });

    return logEntry;
  } catch (err) {
    console.warn(`[AuditLog] Warning: Unable to record audit log: ${err.message}`);
    return null;
  }
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
