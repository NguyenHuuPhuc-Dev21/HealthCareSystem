import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// LƯU Ý (đã kiểm chứng khi build): packages/shared hiện build ra dist dạng
// CommonJS re-export (export *), Vite/Rollup không đọc được named export từ
// dist đó ("UserRole is not exported by .../dist/index.js").
// Cách xử lý tạm: alias thẳng sang source TS của shared để Vite tự biên dịch.
// Khi team chuẩn hoá shared (thêm "type": "module" + trường "exports" vào
// packages/shared/package.json và build lại), xoá alias này đi.
export default defineConfig({
    resolve: {
        alias: {
            '@healthcare-system/shared': fileURLToPath(
                new URL('../../packages/shared/src/index.ts', import.meta.url),
            ),
        },
    },
    server: {
        port: 5175,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
