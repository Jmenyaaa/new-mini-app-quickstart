import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;
    const rawMetadata = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    let metadata: Record<string, unknown> = {};
    if (rawMetadata) {
      try {
        metadata = JSON.parse(rawMetadata as string) as Record<string, unknown>;
      } catch (err) {
        console.error('Invalid metadata JSON:', rawMetadata, err);
        return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 });
      }
    }

    const apiKey = (process.env.LIGHTHOUSE_API_KEY ?? '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'LIGHTHOUSE_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Import inside handler to avoid top-level runtime/module issues
    const { default: lighthouse } = await import('@lighthouse-web3/sdk');

    // 1) Upload image
    const imageName = typeof metadata.name === 'string' && metadata.name.length > 0 ? `${metadata.name}.png` : 'gradient-nft.png';
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const imageUpload: unknown = await lighthouse.uploadBuffer(fileBuffer, apiKey);
    const imageUploadData = (imageUpload as { data?: unknown } | null)?.data;
    const imageCid = (imageUploadData as { Hash?: unknown } | null)?.Hash;
    if (!imageCid || typeof imageCid !== 'string') {
      return NextResponse.json(
        { error: 'Failed to upload image to IPFS', detail: imageUploadData ?? imageUpload },
        { status: 500 }
      );
    }

    // 2) Upload metadata JSON
    const metadataJson = {
      name: (metadata.name as string) || 'Gradient NFT',
      description: (metadata.description as string) || 'Generated with gradient effect',
      image: `ipfs://${imageCid}`,
      properties: {
        gradient: metadata.gradient,
        originalImageSize: metadata.imageSize,
        originalFile: {
          mimeType: file.type,
          size: file.size,
          name: imageName,
        },
      },
    };
    const metadataUpload: unknown = await lighthouse.uploadText(JSON.stringify(metadataJson), apiKey, 'metadata.json');
    const metadataUploadData = (metadataUpload as { data?: unknown } | null)?.data;
    const metadataCid = (metadataUploadData as { Hash?: unknown } | null)?.Hash;
    if (!metadataCid || typeof metadataCid !== 'string') {
      return NextResponse.json(
        { error: 'Failed to upload metadata to IPFS', detail: metadataUploadData ?? metadataUpload },
        { status: 500 }
      );
    }

    const ipfsUrl = `ipfs://${metadataCid}`;
    return NextResponse.json({ success: true, ipfsUrl, result: { imageCid, metadataCid } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('IPFS upload error:', message, error);
    return NextResponse.json({ error: 'Failed to upload to IPFS', detail: message }, { status: 500 });
  }
}
