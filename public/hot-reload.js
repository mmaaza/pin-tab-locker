const filesInDirectory = (dir) =>
    new Promise((resolve) =>
        dir.createReader().readEntries((entries) =>
            Promise.all(
                entries
                    .filter((e) => e.name[0] !== ".")
                    .map((e) =>
                        e.isDirectory
                            ? filesInDirectory(e)
                            : new Promise((resolve) => e.file(resolve))
                    )
            )
                .then((files) => [].concat(...files))
                .then(resolve)
        )
    );

const timestampForFilesInDirectory = (dir) =>
    filesInDirectory(dir).then((files) =>
        files.map((f) => f.name + f.lastModifiedDate).join()
    );

const startAutoReload = () => {
  const RELOAD_INTERVAL_MS = 3000; // Reload every 3 seconds in development mode
  
  setInterval(() => {
    chrome.runtime.reload();
    console.log('Development auto-reload triggered');
  }, RELOAD_INTERVAL_MS);
};

chrome.management.getSelf((self) => {
  if (self.installType === "development") {
    startAutoReload(); // Uncomment this line to enable auto-reload
  }
});
