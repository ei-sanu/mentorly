import { Router } from 'express';
import { asyncHandler } from '../common/async-handler';
import { requireAuth } from '../auth/require-auth';
import { filesService } from './files.service';

export const filesRouter = Router();

filesRouter.post(
  '/files/presign',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    const fileName = req.body?.fileName;
    const fileType = req.body?.fileType;
    const result = await filesService.getPresignedUploadUrl(user.id, fileName, fileType);
    res.status(201).json({ success: true, data: result });
  }),
);

// Developer mock local upload endpoint for sandbox / local tests when S3 is down
filesRouter.post('/files/mock-upload', (req, res) => {
  // Simply return success representing a completed upload
  res.status(200).json({ success: true, message: 'File mocked-uploaded to bucket successfully' });
});

filesRouter.get('/files/mock-download/*path', (req, res) => {
  // Return a dummy empty PDF or byte stream
  res.status(200).send(Buffer.from('MOCK_FILE_CONTENT'));
});
