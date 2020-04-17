/* --------------------------------------------------------------------------------------------
 * This file is changed from Microsoft's sample:
 * https://github.com/microsoft/vscode-extension-samples/blob/master/lsp-sample/client/src/extension.ts
 * ------------------------------------------------------------------------------------------*/

import { join } from 'path'
import { workspace, ExtensionContext, RelativePattern, FileSystemWatcher, Memento, window, commands, Uri } from 'vscode'

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient'

export const ExtensionVersion = require('../package.json').version

let client: LanguageClient

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        join('dist', 'server.js')
    )
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: {
            module: serverModule,
            transport: TransportKind.ipc
        },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    }

    // Options to control the language client
    const clientOptions: LanguageClientOptions & { synchronize: { fileEvents: FileSystemWatcher[] } } = {
        documentSelector: [
            { language: 'mcfunction' },
            { language: 'json', pattern: 'data/*/advancements/**.json' },
            { language: 'json', pattern: 'data/*/loot_tables/**.json' },
            { language: 'json', pattern: 'data/*/predicates/**.json' },
            { language: 'json', pattern: 'data/*/recipes/**.json' },
            { language: 'json', pattern: 'data/*/tags/{block,entity_types,fluids,functions,items}/**.json' }
        ],
        synchronize: {
            fileEvents: []
        },
        initializationOptions: {
            storagePath: context.storagePath,
            globalStoragePath: context.globalStoragePath
        },
        progressOnInitialization: true
    }

    if (workspace.workspaceFolders) {
        for (const root of workspace.workspaceFolders) {
            clientOptions.synchronize.fileEvents.push(
                workspace.createFileSystemWatcher(
                    new RelativePattern(root, 'data/**/*.{json,mcfunction}')
                )
            )
        }
    }

    // Create the language client and start the client.
    client = new LanguageClient(
        'datapack',
        'Datapack Language Server',
        serverOptions,
        clientOptions
    )

    client.registerProposedFeatures()

    // Start the client. This will also launch the server
    client.start()

    client.onReady().then(() => {
        client.onNotification('datapackLanguageServer/checkVersion', ({ currentVersion, title, action, url }) => {
            const lastVersion = context.globalState.get('lastVersion')
            if (lastVersion !== currentVersion) {
                window
                    .showInformationMessage(title, { title: action })
                    .then(
                        value => {
                            if (value && value.title === action) {
                                commands.executeCommand('vscode.open', Uri.parse(url))
                            }
                        },
                        reason => {
                            console.warn(`Errors occurred while indicating new version: ${reason}`)
                        }
                    )
            }
            context.globalState.update('lastVersion', currentVersion)
        })
    })
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined
    }
    return client.stop()
}
