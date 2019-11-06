import * as assert from 'power-assert'
import { describe, it } from 'mocha'
import { CommandTree, CommandTreeNode, getChildren, fillSingleTemplate } from '../CommandTree'
import { fail } from 'assert'
import { TestArgumentParser } from './parsers/LineParser.spec'
import LineParser from '../parsers/LineParser'
import StringReader from '../utils/StringReader'
import ArgumentParserManager from '../parsers/ArgumentParserManager'
import Entity from '../types/Entity'
import ParsingError from '../types/ParsingError'
import Identity from '../types/Identity'
import Vector from '../types/Vector'
import NbtPath from '../types/NbtPath'
import { constructConfig } from '../types/Config'
import Block from '../types/Block'

describe('CommandTree Tests', () => {
    describe('getChildren() Tests', () => {
        const tree: CommandTree = {
            line: { command: { redirect: 'commands' } },
            commands: { execute: { executable: true } }
        }
        it('Should return node.children if it exists', () => {
            const node: CommandTreeNode<any> = { children: { foo: {} } }
            const actual = getChildren(tree, node)
            assert.deepStrictEqual(actual, { foo: {} })
        })
        it('Should handle redirect', () => {
            const node: CommandTreeNode<any> = { redirect: 'line.command' }
            const actual = getChildren(tree, node)
            assert.deepStrictEqual(actual, { execute: { executable: true } })
        })
        it('Should handle single template', () => {
            const node: CommandTreeNode<any> = { template: 'line.command' }
            const actual = getChildren(tree, node)
            assert.deepStrictEqual(actual, { execute: { executable: true } })
        })
        it('Should handle children template', () => {
            const node: CommandTreeNode<any> = { template: 'line', description: 'test' }
            const actual = getChildren(tree, node)
            assert.deepStrictEqual(actual, { command: { redirect: 'commands', description: 'test' } })
        })
        it('Should return undefined when the template does not exist', () => {
            const node: CommandTreeNode<any> = { template: 'line.wtf' }
            const actual = getChildren(tree, node)
            assert(actual === undefined)
        })
        it('Should return undefined when none of `children`, `redirect` and `template` was found.', () => {
            const node: CommandTreeNode<any> = {}
            const actual = getChildren(tree, node)
            assert(actual === undefined)
        })
    })
    describe('fillSingleTemplate() Tests', () => {
        it('Should fill children', () => {
            const template: CommandTreeNode<any> = {
                template: '',
                children: {
                    foo: {
                        executable: true
                    }
                }
            }
            const single: CommandTreeNode<any> = {
                description: 'test'
            }
            const actual = fillSingleTemplate(template, single)
            assert.deepStrictEqual(actual, {
                description: 'test',
                children: {
                    foo: {
                        executable: true
                    }
                }
            })
        })
        it('Should fill description', () => {
            const template: CommandTreeNode<any> = {
                template: '',
                description: 'haha'
            }
            const single: CommandTreeNode<any> = {
                description: 'test'
            }
            const actual = fillSingleTemplate(template, single)
            assert.deepStrictEqual(actual, {
                description: 'haha'
            })
        })
        it('Should fill executable', () => {
            const template: CommandTreeNode<any> = {
                template: '',
                executable: true
            }
            const single: CommandTreeNode<any> = {
                description: 'test'
            }
            const actual = fillSingleTemplate(template, single)
            assert.deepStrictEqual(actual, {
                executable: true,
                description: 'test'
            })
        })
        it('Should fill parser', () => {
            const parser = new TestArgumentParser()
            const template: CommandTreeNode<any> = {
                template: '',
                parser: parser
            }
            const single: CommandTreeNode<any> = {
                description: 'test'
            }
            const actual = fillSingleTemplate(template, single)
            assert.deepStrictEqual(actual, {
                parser, description: 'test'
            })
        })
        it('Should fill permission', () => {
            const template: CommandTreeNode<any> = {
                template: '',
                permission: 4
            }
            const single: CommandTreeNode<any> = {
                description: 'test'
            }
            const actual = fillSingleTemplate(template, single)
            assert.deepStrictEqual(actual, {
                description: 'test',
                permission: 4
            })
        })
        it('Should fill recursively', () => {
            const template: CommandTreeNode<any> = {
                template: '',
                children: {
                    bar: {
                        executable: true
                    }
                }
            }
            const single: CommandTreeNode<any> = {
                description: 'test',
                children: {
                    foo: {
                        description: 'foo'
                    }
                }
            }
            const actual = fillSingleTemplate(template, single)
            assert.deepStrictEqual(actual, {
                description: 'test',
                children: {
                    foo: {
                        description: 'foo',
                        children: {
                            bar: {
                                executable: true
                            }
                        }
                    }
                }
            })
        })
    })
    describe('Just Fucking Parse', () => {
        const manager = new ArgumentParserManager()
        const cache = {
            advancements: {
                'minecraft:test': { def: [], ref: [] }
            }
        }
        it('advancement g', () => {
            const parser = new LineParser(false, undefined, undefined, cache)
            const reader = new StringReader('advancement g')
            const { data } = parser.parse(reader, 13, manager)
            assert.deepEqual(data.args, [
                { data: 'advancement', parser: 'literal' },
                { data: 'g', parser: 'literal' }
            ])
            assert.deepEqual(data.hint, {
                fix: ['advancement', '(grant|revoke)'],
                options: ['<targets: entity>']
            })
            assert.deepEqual(data.cache, undefined)
            assert.deepEqual(data.errors, [
                new ParsingError({ start: 12, end: 13 }, 'expected ‘grant’ or ‘revoke’ but got ‘g’'),
                new ParsingError({ start: 13, end: 15 }, 'expected more arguments but got nothing')
            ])
            assert.deepEqual(data.completions, [{ label: 'grant' }])
        })
        it('advancement (grant|revoke) <targets> everything', () => {
            const parser = new LineParser(false, undefined, undefined, cache)
            const reader = new StringReader('advancement grant @s everything')
            const { data } = parser.parse(reader, -1, manager)
            assert.deepEqual(data.args, [
                { data: 'advancement', parser: 'literal' },
                { data: 'grant', parser: 'literal' },
                { data: new Entity(undefined, 's'), parser: 'entity' },
                { data: 'everything', parser: 'literal' }
            ])
            assert.deepEqual(data.hint, {
                fix: ['advancement', '(grant|revoke)', '<targets: entity>', 'everything'],
                options: []
            })
            assert.deepEqual(data.cache, undefined)
            assert.deepEqual(data.errors, undefined)
            assert.deepEqual(data.completions, undefined)
        })
        it('advancement (grant|revoke) <targets> only <advancement>', () => {
            const parser = new LineParser(false, undefined, undefined, cache)
            const reader = new StringReader('advancement grant @s only test')
            const { data } = parser.parse(reader, -1, manager)
            assert.deepEqual(data.args, [
                { data: 'advancement', parser: 'literal' },
                { data: 'grant', parser: 'literal' },
                { data: new Entity(undefined, 's'), parser: 'entity' },
                { data: 'only', parser: 'literal' },
                { data: new Identity(undefined, ['test']), parser: 'namespacedID' }
            ])
            assert.deepEqual(data.hint, {
                fix: ['advancement', '(grant|revoke)', '<targets: entity>', 'only', '<advancement: namespacedID>'],
                options: []
            })
            assert.deepEqual(data.cache, {
                advancements: {
                    'minecraft:test': { def: [], ref: [{ range: { start: 26, end: 30 } }] }
                }
            })
            assert.deepEqual(data.errors, undefined)
            assert.deepEqual(data.completions, undefined)
        })
        it('advancement (grant|revoke) <targets> only <advancement> <criterion>', () => {
            const parser = new LineParser(false, undefined, undefined, cache)
            const reader = new StringReader('advancement grant @s only test aaa')
            const { data } = parser.parse(reader, -1, manager)
            assert.deepEqual(data.args, [
                { data: 'advancement', parser: 'literal' },
                { data: 'grant', parser: 'literal' },
                { data: new Entity(undefined, 's'), parser: 'entity' },
                { data: 'only', parser: 'literal' },
                { data: new Identity(undefined, ['test']), parser: 'namespacedID' },
                { data: 'aaa', parser: 'string' }
            ])
            assert.deepEqual(data.hint, {
                fix: ['advancement', '(grant|revoke)', '<targets: entity>', 'only', '<advancement: namespacedID>', '<criterion: string>'],
                options: []
            })
            assert.deepEqual(data.cache, {
                advancements: {
                    'minecraft:test': { def: [], ref: [{ range: { start: 26, end: 30 } }] }
                }
            })
            assert.deepEqual(data.errors, undefined)
            assert.deepEqual(data.completions, undefined)
        })
        it('advancement (grant|revoke) <targets> (from|through|until) <advancement>', () => {
            const parser = new LineParser(false, undefined, undefined, cache)
            const reader = new StringReader('advancement revoke @s through minecraft:test')
            const { data } = parser.parse(reader, -1, manager)
            assert.deepEqual(data.args, [
                { data: 'advancement', parser: 'literal' },
                { data: 'revoke', parser: 'literal' },
                { data: new Entity(undefined, 's'), parser: 'entity' },
                { data: 'through', parser: 'literal' },
                { data: new Identity(undefined, ['test']), parser: 'namespacedID' }
            ])
            assert.deepEqual(data.hint, {
                fix: ['advancement', '(grant|revoke)', '<targets: entity>', '(from|through|until)', '<advancement: namespacedID>'],
                options: []
            })
            assert.deepEqual(data.cache, {
                advancements: {
                    'minecraft:test': { def: [], ref: [{ range: { start: 30, end: 44 } }] }
                }
            })
            assert.deepEqual(data.errors, undefined)
            assert.deepEqual(data.completions, undefined)
        })
        it('data get block <targetPos> <path>', () => {
            const parser = new LineParser(false, undefined, undefined, cache)
            const reader = new StringReader('data get block ~ ~ ~ CustomName')
            const { data } = parser.parse(reader, -1, manager)
            assert.deepEqual(data.args, [
                { data: 'data', parser: 'literal' },
                { data: 'get', parser: 'literal' },
                { data: 'block', parser: 'literal' },
                { data: new Vector([{ type: 'relative', value: '' }, { type: 'relative', value: '' }, { type: 'relative', value: '' }]), parser: 'vector3D' },
                { data: new NbtPath(['CustomName']), parser: 'nbtPath' }
            ])
            assert.deepEqual(data.hint, {
                fix: ['data', 'get', 'block', '<pos: vector3D>', '<path: nbtPath>'],
                options: []
            })
            assert.deepEqual(data.cache, undefined)
            assert.deepEqual(data.errors, undefined)
            assert.deepEqual(data.completions, undefined)
        })
        it('setblock ~ ~ ~ minecraft:grass_block[]', () => {
            const parser = new LineParser(false, undefined, undefined, cache)
            const reader = new StringReader('setblock ~ ~ ~ minecraft:grass_block[]')
            const { data } = parser.parse(reader, 37, manager)
            assert.deepEqual(data.args, [
                { data: 'setblock', parser: 'literal' },
                { data: new Vector([{ type: 'relative', value: '' }, { type: 'relative', value: '' }, { type: 'relative', value: '' }]), parser: 'vector3D' },
                { data: new Block(new Identity(undefined, ['grass_block'])), parser: 'block' }
            ])
            assert.deepEqual(data.hint, {
                fix: ['setblock', '<pos: vector3D>', '<block: block>'],
                options: ['[destroy|keep|replace]']
            })
            assert.deepEqual(data.cache, undefined)
            assert.deepEqual(data.errors, undefined)
            assert.deepEqual(data.completions, [{ label: 'snowy' }])
        })
    })
})