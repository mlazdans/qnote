/*
 * This file is provided by the addon-developer-support repository at
 * https://github.com/thundernest/addon-developer-support
 *
 * Version 1.0
 * - initial release
 *
 * Authors:
 * - John Bieling (john@thunderbird.net)
 * - Arnd Issler (email@arndissler.net)
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

(function (exports) {

  // Import some things we need.
  var { ExtensionUtils }  = ChromeUtils.importESModule("resource://gre/modules/ExtensionUtils.sys.mjs");
  // var { Services }        = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
  var { ExtensionError } = ExtensionUtils;

  let resourceUrls = new Set();

  class ResourceUrl extends ExtensionCommon.ExtensionAPI {
    // The API implementation.
    getAPI(context) {
      return {
        ResourceUrl: {
          register(namespace, folder) {
            const resProto = Cc[
              "@mozilla.org/network/protocol;1?name=resource"
            ].getService(Ci.nsISubstitutingProtocolHandler);

            let uri = Services.io.newURI(
              folder || ".",
              null,
              context.extension.rootURI
            );
            // Allow re-registering the same mapping (e.g. leftover after an add-on reload whose shutdown failed)
            if (resProto.hasSubstitution(namespace) && !resProto.getSubstitution(namespace).equals(uri)) {
              throw new ExtensionError(`There is already a resource:// url for the namespace "${namespace}"`);
            }
            resProto.setSubstitutionWithFlags(
              namespace,
              uri,
              resProto.ALLOW_CONTENT_ACCESS
            );
            resourceUrls.add(namespace);
          }
        }
      };
    }

    onShutdown(isAppShutdown) {
      if (isAppShutdown) {
        return; // the application gets unloaded anyway
      }

      // Unload JSMs of this add-on. JSM support (Cu.loadedModules / Cu.unload) is gone in newer TB;
      // ES modules can't be unloaded at all, they stay cached until restart.
      if (Cu.loadedModules && Cu.unload) {
        for (let module of Cu.loadedModules) {
          let [schema, , namespace] = module.split("/");
          if (schema == "resource:" && resourceUrls.has(namespace)) {
            console.log("Unloading module", module);
            Cu.unload(module);
          }
        }
      }

      // Flush all caches
      Services.obs.notifyObservers(null, "startupcache-invalidate");

      const resProto = Cc[
        "@mozilla.org/network/protocol;1?name=resource"
      ].getService(Ci.nsISubstitutingProtocolHandler);

      resourceUrls.forEach(namespace => {
        console.log("Unloading namespace", namespace);
        resProto.setSubstitution(namespace, null);
      });
    }
  }

  exports.ResourceUrl = ResourceUrl;
})(this);
