# Cross-package foundation tests

This directory is reserved for tests that exercise multiple workspace packages or infrastructure boundaries. Package-local tests remain close to their owning package.

Do not add fake product fixtures here. Future cross-module integration tests should use real infrastructure contracts and controlled test data only.
