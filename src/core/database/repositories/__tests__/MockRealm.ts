
/**
 * A basic manual mock for Realm to test repositories without native dependencies.
 */
export class MockRealm {
  private data: Record<string, any[]> = {};

  objects(name: string | { schema: { name: string } }) {
    const schemaName = typeof name === 'string' ? name : (name as any).schema.name;
    const items = this.data[schemaName] || [];
    
    // Add basic chainable methods
    return {
      filtered: (query: string, ...args: any[]) => items, // Minimal filtering simulation
      sorted: (key: string, reverse?: boolean) => items,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      length: items.length,
      [Symbol.iterator]: function* () {
        for (const item of items) yield item;
      },
      map: (fn: any) => items.map(fn),
      find: (fn: any) => items.find(fn),
      findIndex: (fn: any) => items.findIndex(fn),
      forEach: (fn: any) => items.forEach(fn),
      0: items[0],
    };
  }

  objectForPrimaryKey(name: string | { schema: { name: string } }, key: any) {
    const schemaName = typeof name === 'string' ? name : (name as any).schema.name;
    const items = this.data[schemaName] || [];
    return items.find(i => i.id === key) || null;
  }

  write(callback: () => void) {
    callback();
  }

  create(name: string | { schema: { name: string } }, props: any, updateMode?: string) {
    const schemaName = typeof name === 'string' ? name : (name as any).schema.name;
    if (!this.data[schemaName]) this.data[schemaName] = [];
    
    const existingIdx = this.data[schemaName].findIndex(i => i.id === props.id);
    if (existingIdx > -1 && updateMode) {
      this.data[schemaName][existingIdx] = { ...this.data[schemaName][existingIdx], ...props };
      return this.data[schemaName][existingIdx];
    } else {
      const newObj = { ...props };
      // Simulate Realm List for chapters
      if (newObj.chapters && Array.isArray(newObj.chapters)) {
          newObj.chapters.forEach = newObj.chapters.forEach.bind(newObj.chapters);
          newObj.chapters.map = newObj.chapters.map.bind(newObj.chapters);
      }
      this.data[schemaName].push(newObj);
      return newObj;
    }
  }

  delete(obj: any) {
    // Basic delete simulation
    for (const key in this.data) {
      this.data[key] = this.data[key].filter(i => i !== obj);
    }
  }
}
