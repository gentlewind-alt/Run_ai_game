// Android build only (vite alias for the RUN SDK): stands in for the SDK so none of it ships in the app.
// Every member reports "not here": isAvailable() is false and every other call does nothing.
const off: any = new Proxy(function () { /* nothing */ }, {
  get: (_t, key) => (key === 'isAvailable' ? () => false : off),
  apply: () => undefined,
});
export default off;
