import { NFTStorage } from 'nft.storage';
import { NextRequest, NextResponse } from 'next/server';

const NFT_STORAGE_TOKEN = process.env.NFT_STORAGE_TOKEN || '';

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

    if (!NFT_STORAGE_TOKEN) {
      console.error('NFT_STORAGE_TOKEN missing in environment');
      return NextResponse.json({ error: 'NFT_STORAGE_TOKEN not configured' }, { status: 500 });
    }

    const client = new NFTStorage({ token: NFT_STORAGE_TOKEN });

    const result: unknown = await client.store({
      name: (metadata.name as string) || 'Gradient NFT',
      description: (metadata.description as string) || 'Generated with gradient effect',
      // `file` is a Blob (from formData); NFTStorage accepts Blob/File
      image: file,
      properties: {
        gradient: metadata.gradient,
        originalImageSize: metadata.imageSize,
      },
    });

    const asResult = result as Record<string, unknown>;
    const ipnft = (asResult?.ipnft as string | undefined) || (asResult?.ipfsHash as string | undefined) || null;
    const urlCandidate = (asResult?.url as string | undefined) || null;
    const ipfsUrl = ipnft ? `ipfs://${ipnft}` : urlCandidate;

    return NextResponse.json({ success: true, ipfsUrl, result: asResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('IPFS upload error:', message, error);
    return NextResponse.json({ error: 'Failed to upload to IPFS', detail: message }, { status: 500 });
  }
}
