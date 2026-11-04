import { describe, expect, it } from 'vitest';
import { copyProjectContents, projectCopyName } from '@/lib/projectCopy';

describe('independent project copies', () => {
  it('allocates distinct names, including case-insensitive collisions and long names', () => {
    expect(projectCopyName('Flange', [])).toBe('Flange (copy)');
    expect(projectCopyName('Flange', ['FLANGE (COPY)', 'Flange (copy 2)'])).toBe('Flange (copy 3)');
    expect(projectCopyName('Фланец', [], 'копия')).toBe('Фланец (копия)');
    expect(projectCopyName('x'.repeat(200), []).length).toBeLessThanOrEqual(80);
  });
  it('clones mesh buffers, assets, history and ruler attachments without losing internal IDs', () => {
    const mesh = { id: 'shape-1', positions: new Float32Array([1, 2, 3]), labels: [{ id: 'face-1' }] };
    const source = { shapes: [mesh], history: [{ shapes: [mesh] }], rulers: { points: [{ attachment: { shapeId: 'shape-1', normalized: [0, 1, 0] } }] }, assets: [{ bytes: new Uint8Array([4, 5]) }] };
    const copy = copyProjectContents(source);
    copy.shapes[0].positions[0] = 99; copy.assets[0].bytes[0] = 0; copy.shapes[0].labels[0].id = 'changed';
    expect(source.shapes[0].positions[0]).toBe(1); expect(source.assets[0].bytes[0]).toBe(4); expect(source.shapes[0].labels[0].id).toBe('face-1');
    expect(copy.rulers.points[0].attachment.shapeId).toBe(copy.shapes[0].id);
    expect(copy.history[0].shapes[0]).toBe(copy.shapes[0]);
  });
});
