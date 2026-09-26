import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ data, error: null }, { status: init ?? 200 });
}

export function fail(code: string, message: string, init = 400, details?: unknown) {
  return NextResponse.json({ data: null, error: { code, message, details } }, { status: init });
}
