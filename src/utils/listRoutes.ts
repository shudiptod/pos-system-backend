import { Application, Router } from "express";

interface RouteInfo {
  method: string;
  path: string;
}

export function listRoutes(app: Application): RouteInfo[] {
  const routes: RouteInfo[] = [];

  function traverse(stack: any[], prefix = "") {
    stack.forEach((layer) => {
      if (layer.route) {
        // Direct route
        const methods = Object.keys(layer.route.methods)
          .map((m) => m.toUpperCase())
          .join(", ");
        routes.push({ method: methods, path: prefix + layer.route.path });
      } else if (layer.name === "router" && layer.handle.stack) {
        // Nested router
        // Reconstruct prefix from layer.regexp
        let newPrefix = prefix;
        if (layer.regexp?.source) {
          const match = layer.regexp.source
            .replace("\\/?", "")          // optional trailing slash
            .replace(/\\\//g, "/")       // escaped slash
            .replace(/^\^/, "")          // starting ^
            .replace(/\$$/, "");         // ending $
          newPrefix += "/" + match;
          newPrefix = newPrefix.replace(/\/+/g, "/"); // remove double slashes
          newPrefix = newPrefix.replace(/\(\?:\(\[\^/g, ":"); // param placeholder fix
        }
        traverse(layer.handle.stack, newPrefix);
      }
    });
  }

  if (app._router?.stack) {
    traverse(app._router.stack);
  }

  return routes;
}
