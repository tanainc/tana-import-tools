export const fsToFileSystem = (incomingFs) => {
    return {
        existsSync: incomingFs.existsSync,
        statSync: incomingFs.statSync,
        readdirSync: function (path, options) {
            return incomingFs.readdirSync(path, {
                withFileTypes: options.withFileTypes
            });
        },
        readFileSync: incomingFs.readFileSync,
    };
};
