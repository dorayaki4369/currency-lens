// Resolves extension asset URLs to the flag icons served from the test public directory.
Object.assign(globalThis, {
  browser: {
    runtime: {
      getURL(path: string): string {
        return `./4x3/${path.split("/").at(-1) ?? path}`;
      },
    },
  },
});
