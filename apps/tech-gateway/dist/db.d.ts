import type { Database as SQLiteDatabase } from 'better-sqlite3';
declare const db: SQLiteDatabase;
export declare function logMessage(phone: string, body: string, dir: 'in' | 'out'): {
    id: string;
    phone: string;
    body: string;
    dir: "in" | "out";
    ts: number;
};
export declare function recentMessages(phone: string, limit?: number): unknown[];
export default db;
//# sourceMappingURL=db.d.ts.map