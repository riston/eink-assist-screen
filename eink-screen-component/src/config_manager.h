#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include "config.h"

namespace ConfigManager {
    // Load configuration from remote server
    // Updates the provided config struct
    // Returns true on success
    bool loadRemoteConfig(RemoteConfig& config);

    // Build the full image URL with all parameters
    // Returns URL string for the specified chunk
    String buildImageUrl(const RemoteConfig& config, int chunkOffsetBytes, int chunkLimitBytes);
}

#endif
