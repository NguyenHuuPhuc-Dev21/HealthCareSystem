import { describe, expect, it } from 'vitest';
import { checksumOf, planMigrations, type MigrationFile } from '../../src/core/database/migrator';

const file = (id: string, content: string): MigrationFile => ({ id, absolutePath: `/x/${id}`, checksum: checksumOf(content) });

describe('checksumOf', () => {
  it('ignores CRLF vs LF so Windows checkouts are not flagged as edited', () => {
    expect(checksumOf('a;\r\nb;\r\n')).toBe(checksumOf('a;\nb;\n'));
  });
  it('changes when content changes', () => {
    expect(checksumOf('a;')).not.toBe(checksumOf('b;'));
  });
});

describe('planMigrations', () => {
  const m1 = file('migrations/0001_init.sql', 'create table a();');
  const m2 = file('migrations/0002_more.sql', 'insert into a default values;');
  const s1 = file('seeds/001_ref.sql', 'insert …');

  it('on an empty history everything is pending, in the given order', () => {
    const plan = planMigrations([m1, m2, s1], new Map());
    expect(plan.pending.map((f) => f.id)).toEqual([m1.id, m2.id, s1.id]);
    expect(plan.modified).toEqual([]);
  });

  it('skips applied files with a matching checksum', () => {
    const plan = planMigrations([m1, m2, s1], new Map([[m1.id, m1.checksum]]));
    expect(plan.pending.map((f) => f.id)).toEqual([m2.id, s1.id]);
  });

  it('reports applied files whose content was edited', () => {
    const plan = planMigrations([m1, m2], new Map([[m1.id, checksumOf('something else')]]));
    expect(plan.modified.map((f) => f.id)).toEqual([m1.id]);
  });
});
