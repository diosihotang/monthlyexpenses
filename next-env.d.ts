/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// Deklarasi supaya TypeScript tidak komplain saat import file CSS
// Next.js handle CSS imports secara native, tapi TS tidak tahu itu
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
