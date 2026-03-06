
import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const start = performance.now();
    const useMockData = (process.env.USE_MOCK_DATA || '').trim() === 'true';
    
    try {
        // Check if using mock data
        if (useMockData) {
            return NextResponse.json({
                status: 'ok',
                version: '1.2.0-mock-mode',
                timestamp: new Date().toISOString(),
                db_latency_ms: 0,
                environment: process.env.NODE_ENV,
                mode: 'MOCK_DATA',
                message: 'Running with mock data for testing',
            });
        }
        
        // Simple DB query to check latency
        await prisma.$queryRaw`SELECT 1`;
        const dbLatency = performance.now() - start;

        return NextResponse.json({
            status: 'ok',
            version: '1.2.0-perf-fix',
            timestamp: new Date().toISOString(),
            db_latency_ms: dbLatency,
            environment: process.env.NODE_ENV,
            mode: 'LIVE_DATABASE',
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            error: error.message,
            useMockData: useMockData,
            env: process.env.NODE_ENV,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
