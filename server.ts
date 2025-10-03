// server.ts
// FIX: Declare the Deno global object to resolve the TypeScript error "Cannot find name 'Deno'".
// This is necessary when the Deno types are not configured in the project's tsconfig.
declare const Deno: any;

import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

Deno.serve((req) => {
  return serveDir(req, {
    fsRoot: ".", // 从当前目录提供文件
    quiet: true, // 抑制每个请求的日志
  });
});