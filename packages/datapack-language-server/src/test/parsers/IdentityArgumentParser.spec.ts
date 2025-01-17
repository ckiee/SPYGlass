import assert = require('power-assert')
import { describe, it } from 'mocha'
import { CompletionItemKind, DiagnosticSeverity } from 'vscode-languageserver'
import { IdentityNode } from '../../nodes/IdentityNode'
import { IdentityArgumentParser } from '../../parsers/IdentityArgumentParser'
import { constructConfig } from '../../types/Config'
import { NamespaceSummary } from '../../types/NamespaceSummary'
import { constructContext, ParsingContext } from '../../types/ParsingContext'
import { ErrorCode, ParsingError } from '../../types/ParsingError'
import { Registry } from '../../types/Registry'
import { StringReader } from '../../utils/StringReader'
import { $, assertCompletions } from '../utils.spec'
import { NodeDescription } from '../../nodes'

describe('IdentityArgumentParser Tests', () => {
	describe('getExamples() Tests', () => {
		it('Should return examples', () => {
			const parser = new IdentityArgumentParser('spgoding:test')
			const actual = parser.getExamples()
			assert.deepStrictEqual(actual, ['example:foo/bar'])
		})
	})

	const registries: Registry = {
		'spgoding:test': {
			protocol_id: 0,
			entries: {
				'spgoding:a': { protocol_id: 0 },
				'spgoding:b': { protocol_id: 1 },
				'spgoding:c': { protocol_id: 2 },
			},
		},
		'minecraft:fluid': {
			protocol_id: 1,
			entries: {
				'minecraft:water': { protocol_id: 0 },
				'minecraft:lava': { protocol_id: 1 },
			},
		},
		'minecraft:item': {
			protocol_id: 2,
			entries: {
				'minecraft:stick': { protocol_id: 0 },
			},
		},
		'minecraft:block': {
			protocol_id: 3,
			entries: {
				'minecraft:stone': { protocol_id: 0 },
			},
		},
		'minecraft:entity_type': {
			protocol_id: 4,
			entries: {
				'minecraft:area_effect_cloud': { protocol_id: 0 },
			},
		},
		'spgoding:seg_completion_test': {
			protocol_id: 5,
			entries: {
				'spgoding:foo': { protocol_id: 0 },
				'spgoding:foo/bar': { protocol_id: 1 },
				'spgoding:foo/bar/baz': { protocol_id: 2 },
				'minecraft:foo': { protocol_id: 3 },
				'minecraft:foo/bar': { protocol_id: 4 },
				'minecraft:foo/bar/baz': { protocol_id: 5 },
			},
		},
	}
	const cache = {
		advancement: {
			'spgoding:advancement': { def: [], ref: [] },
			'spgoding:doc_test': { doc: 'This is the doc.' },
		},
		bossbar: {
			'spgoding:bossbar/a': { def: [], ref: [] },
			'spgoding:bossbar/b': { def: [], ref: [] },
			'spgoding:QwQ': {},
		},
		'tag/function': {
			'spgoding:function/1': { def: [], ref: [] },
			'spgoding:function/2': { def: [], ref: [] },
		},
		'tag/fluid': {
			'minecraft:fluid_tag': { def: [], ref: [] },
		},
		'tag/entity_type': {
			'spgoding:entity_type/1': { def: [], ref: [] },
			'spgoding:entity_type/2': { def: [], ref: [] },
		},
		'tag/block': {
			'minecraft:block/1': { def: [], ref: [] },
		},
		'tag/item': {
			'spgoding:item/1': { def: [], ref: [] },
			'spgoding:item/2': { def: [], ref: [] },
		},
		loot_table: {
			'spgoding:loot_table/foo': { def: [], ref: [] },
		},
	}
	const config = constructConfig({
		env: { dependsOnVanilla: false },
		lint: { idOmitDefaultNamespace: null },
	})
	const summary: NamespaceSummary = {
		advancement: ['minecraft:adventure/root'],
	} as NamespaceSummary
	let ctx: ParsingContext
	before(async () => {
		ctx = constructContext({ registry: registries, cache, config })
	})
	describe('parse() Tests', () => {
		it('Should return data with single path', () => {
			const parser = new IdentityArgumentParser('spgoding:test')
			const actual = parser.parse(new StringReader('spgoding:a'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['a'], undefined, 'spgoding:test'), [0, 10]))
		})
		it('Should return data with multiple paths', () => {
			const parser = new IdentityArgumentParser('spgoding:test')
			const actual = parser.parse(new StringReader('spgoding:a/b/c'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['a', 'b', 'c'], undefined, 'spgoding:test'), [0, 14]))
		})
		it('Should return data without namespace', () => {
			const parser = new IdentityArgumentParser('spgoding:test')
			const actual = parser.parse(new StringReader('a/b'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['a', 'b'], undefined, 'spgoding:test'), [0, 3]))
		})
		it('Should return data with tag ID', () => {
			const parser = new IdentityArgumentParser('minecraft:fluid', true)
			const actual = parser.parse(new StringReader('#minecraft:fluid_tag'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('minecraft', ['fluid_tag'], true, 'minecraft:fluid'), [0, 20]))
		})
		it('Should return data under array registry', async () => {
			const config = constructConfig({ lint: { idOmitDefaultNamespace: null } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser(['minecraft:qux'])
			const actual = parser.parse(new StringReader('qux'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['qux']), [0, 3]))
			assert.deepStrictEqual(actual.errors, [])
		})
		it('Should return data with the cache doc', () => {
			const parser = new IdentityArgumentParser('$advancement')
			const actual = parser.parse(new StringReader('spgoding:doc_test'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['doc_test'], undefined, '$advancement'), [0, 17], { [NodeDescription]: 'This is the doc.' }))
		})
		it('Should return completions for registry entries', async () => {
			const ctx = constructContext({ registry: registries, cache, cursor: 0 })
			const parser = new IdentityArgumentParser('spgoding:test')
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions, [
				{
					label: 'spgoding',
					kind: CompletionItemKind.Module,
					t: 'spgoding',
				},
			])
		})
		it('Should return completions for "THIS"', async () => {
			const ctx = constructContext({
				registry: registries, cache, cursor: 0,
				id: new IdentityNode('spgoding', ['this', 'is', 'the', 'current', 'function']),
			})
			const parser = new IdentityArgumentParser('$advancement')
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions.filter(v => v.label === 'THIS'), [
				{
					label: 'THIS',
					t: 'spgoding:this/is/the/current/function',
					detail: 'spgoding:this/is/the/current/function',
					kind: CompletionItemKind.Snippet,
				},
			])
		})
		it('Should return completions for array registry', async () => {
			const ctx = constructContext({ registry: registries, cache, cursor: 0 })
			const parser = new IdentityArgumentParser(['spgoding:foo'])
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions, [
				{
					label: 'spgoding',
					kind: CompletionItemKind.Module,
					t: 'spgoding',
				},
			])
		})
		it('Should return completions for cache units', async () => {
			const ctx = constructContext({ registry: registries, cache, cursor: 0 })
			const parser = new IdentityArgumentParser('$bossbar')
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions, [
				{
					label: 'spgoding',
					kind: CompletionItemKind.Module,
					t: 'spgoding',
				},
			])
		})
		it('Should return completions in the vanilla datapack', async () => {
			const config = constructConfig({ env: { dependsOnVanilla: true }, lint: { idOmitDefaultNamespace: null } })
			const ctx = constructContext({ registry: registries, config, namespaceSummary: summary, cache, cursor: 0 })
			const parser = new IdentityArgumentParser('$advancement')
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions, [
				{
					label: 'spgoding',
					kind: CompletionItemKind.Module,
					t: 'spgoding',
				},
				{
					label: 'minecraft',
					kind: CompletionItemKind.Module,
					t: 'minecraft',
				},
				{
					label: 'adventure',
					kind: CompletionItemKind.Folder,
					t: 'adventure',
				},
			])
		})
		it('Should return completions for advancements with Event kind', async () => {
			const ctx = constructContext({ registry: registries, cache, cursor: 9 })
			const parser = new IdentityArgumentParser('$advancement')
			const reader = new StringReader('spgoding:')
			const actual = parser.parse(reader, ctx)
			assertCompletions(reader, actual.completions, [
				{
					label: 'advancement',
					kind: CompletionItemKind.Event,
					t: 'spgoding:advancement',
				},
				{
					label: 'doc_test',
					kind: CompletionItemKind.Event,
					t: 'spgoding:doc_test',
				},
			])
		})
		it('Should return completions for functions with Function kind', async () => {
			const ctx = constructContext({ registry: registries, cache, cursor: 19 })
			const parser = new IdentityArgumentParser('$function', true)
			const reader = new StringReader('#spgoding:function/')
			const actual = parser.parse(reader, ctx)
			assertCompletions(reader, actual.completions,
				[
					{
						label: '1',
						kind: CompletionItemKind.Function,
						t: '#spgoding:function/1',
					},
					{
						label: '2',
						kind: CompletionItemKind.Function,
						t: '#spgoding:function/2',
					},
				]
			)
		})
		it('Should return completions for fluid and fluid tags', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('minecraft:fluid', true)
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: '#minecraft',
						t: '#minecraft',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'minecraft',
						t: 'minecraft',
						kind: CompletionItemKind.Module,
					},
					{
						label: '#fluid_tag',
						t: '#fluid_tag',
						kind: CompletionItemKind.Field,
					},
					{
						label: 'water',
						t: 'water',
						kind: CompletionItemKind.Field,
					},
					{
						label: 'lava',
						t: 'lava',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should return completions for functions and function tags', async () => {
			const ctx = constructContext({ registry: registries, cache, cursor: 0 })
			const parser = new IdentityArgumentParser('$function', true)
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: '#spgoding',
						t: '#spgoding',
						kind: CompletionItemKind.Module,
					},
				]
			)
		})
		it('Should return completions for items and item tags', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('minecraft:item', true)
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: '#spgoding',
						t: '#spgoding',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'minecraft',
						t: 'minecraft',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'stick',
						t: 'stick',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should return completions for blocks and block tags', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('minecraft:block', true)
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: '#minecraft',
						t: '#minecraft',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'minecraft',
						t: 'minecraft',
						kind: CompletionItemKind.Module,
					},
					{
						label: '#block',
						t: '#block',
						kind: CompletionItemKind.Folder,
					},
					{
						label: 'stone',
						t: 'stone',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should return completions for entity types and entity type tags', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('minecraft:entity_type', true)
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: '#spgoding',
						t: '#spgoding',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'minecraft',
						t: 'minecraft',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'area_effect_cloud',
						t: 'area_effect_cloud',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should not return completions for namespaces when should omit namespaces for tags', async () => {
			const config = constructConfig({
				env: { dependsOnVanilla: false },
				lint: { idOmitDefaultNamespace: ['warning', true] },
			})
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('minecraft:fluid', true)
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: '#fluid_tag',
						t: '#fluid_tag',
						kind: CompletionItemKind.Field,
					},
					{
						label: 'water',
						t: 'water',
						kind: CompletionItemKind.Field,
					},
					{
						label: 'lava',
						t: 'lava',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should return completions for namespaces and the first path in default namespace', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('spgoding:seg_completion_test')
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: 'spgoding',
						t: 'spgoding',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'minecraft',
						t: 'minecraft',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'foo',
						t: 'foo',
						kind: CompletionItemKind.Folder,
					},
					{
						label: 'foo',
						t: 'foo',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should only return completions for namespaces when cannot omit namespaces', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('spgoding:seg_completion_test', undefined, true)
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: 'spgoding',
						t: 'spgoding',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'minecraft',
						t: 'minecraft',
						kind: CompletionItemKind.Module,
					},
				]
			)
		})
		it('Should not only return completions for namespaces when should omit namespaces', async () => {
			const config = constructConfig({ lint: { strictBossbarCheck: null, idOmitDefaultNamespace: ['warning', true] } })
			const ctx = constructContext({ registry: registries, cache, config, cursor: 0 })
			const parser = new IdentityArgumentParser('spgoding:seg_completion_test')
			const actual = parser.parse(new StringReader(''), ctx)
			assertCompletions('', actual.completions,
				[
					{
						label: 'spgoding',
						t: 'spgoding',
						kind: CompletionItemKind.Module,
					},
					{
						label: 'foo',
						t: 'foo',
						kind: CompletionItemKind.Folder,
					},
					{
						label: 'foo',
						t: 'foo',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should return completions for the first path in non-default namespace', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 9 })
			const parser = new IdentityArgumentParser('spgoding:seg_completion_test')
			const reader = new StringReader('spgoding:')
			const actual = parser.parse(reader, ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', [''], undefined, 'spgoding:seg_completion_test'), [0, 9]))
			assertCompletions(reader, actual.completions,
				[
					{
						label: 'foo',
						t: 'spgoding:foo',
						kind: CompletionItemKind.Folder,
					},
					{
						label: 'foo',
						t: 'spgoding:foo',
						kind: CompletionItemKind.Field,
					},
				]
			)
		})
		it('Should return completions for the second path in non-default namespace', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 13 })
			const parser = new IdentityArgumentParser('spgoding:seg_completion_test')
			const reader = new StringReader('spgoding:foo/')
			const actual = parser.parse(reader, ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['foo', ''], undefined, 'spgoding:seg_completion_test'), [0, 13]))
			assertCompletions(reader, actual.completions, [
				{
					label: 'bar',
					t: 'spgoding:foo/bar',
					kind: CompletionItemKind.Folder,
				},
				{
					label: 'bar',
					t: 'spgoding:foo/bar',
					kind: CompletionItemKind.Field,
				},
			])
		})
		it('Should return completions for the third path in non-default namespace', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 17 })
			const parser = new IdentityArgumentParser('spgoding:seg_completion_test')
			const reader = new StringReader('spgoding:foo/bar/')
			const actual = parser.parse(reader, ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['foo', 'bar', ''], undefined, 'spgoding:seg_completion_test'), [0, 17]))
			assertCompletions(reader, actual.completions, [
				{
					label: 'baz',
					t: 'spgoding:foo/bar/baz',
					kind: CompletionItemKind.Field,
				},
			])
		})
		it('Should return completions for the second path in default namespace', async () => {
			const ctx = constructContext({ registry: registries, cache, config, cursor: 4 })
			const parser = new IdentityArgumentParser('spgoding:seg_completion_test')
			const reader = new StringReader('foo/')
			const actual = parser.parse(reader, ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['foo', ''], undefined, 'spgoding:seg_completion_test'), [0, 4]))
			assertCompletions(reader, actual.completions, [
				{
					label: 'bar',
					t: 'foo/bar',
					kind: CompletionItemKind.Folder,
				},
				{
					label: 'bar',
					t: 'foo/bar',
					kind: CompletionItemKind.Field,
				},
			])
		})
		it('Should return untolerable error when the input is empty', async () => {
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('spgoding:test')
			const actual = parser.parse(new StringReader(''), ctx)
			assert.deepStrictEqual(actual.errors, [
				new ParsingError({ start: 0, end: 1 }, 'Expected a namespaced ID but got nothing', false),
			])
		})
		it('Should return errors for non [a-z0-9/._-] characters', async () => {
			const config = constructConfig({ lint: { strictBossbarCheck: null, idOmitDefaultNamespace: ['warning', false] } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('$bossbar')
			const actual = parser.parse(new StringReader('spgoding:QwQ'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['QwQ'], undefined, '$bossbar'), [0, 12]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError({ start: 9, end: 12 }, 'Found non [a-z0-9/._-] character(s)'),
			])
		})
		it('Should return errors when the id cannot be resolved in cache category', async () => {
			const config = constructConfig({ lint: { strictBossbarCheck: ['warning', true], idOmitDefaultNamespace: null } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('$bossbar')
			const actual = parser.parse(new StringReader('foo'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['foo'], undefined, '$bossbar'), [0, 3]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError(
					{ start: 0, end: 3 },
					'Failed to resolve namespaced ID “minecraft:foo” in cache category “bossbar” (rule: “strictBossbarCheck”)',
					undefined, DiagnosticSeverity.Warning, ErrorCode.IdentityUnknown
				),
			])
		})
		it('Should return errors when the id cannot be resolved in loot table cache', async () => {
			const config = constructConfig({ lint: { strictLootTableCheck: ['warning', true], idOmitDefaultNamespace: ['warning', true] } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('$loot_table')
			const actual = parser.parse(new StringReader('foo'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['foo'], undefined, '$loot_table'), [0, 3]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError(
					{ start: 0, end: 3 },
					'Failed to resolve namespaced ID “minecraft:foo” in cache category “loot_table” (rule: “strictLootTableCheck”)',
					undefined, DiagnosticSeverity.Warning, ErrorCode.IdentityUnknown
				),
			])
		})
		it('Should return errors when the id cannot be resolved in tag cache category', async () => {
			const config = constructConfig({ lint: { strictFunctionTagCheck: ['warning', true], idOmitDefaultNamespace: ['warning', true] } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('$function', true)
			const actual = parser.parse(new StringReader('#spgoding:function/42'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['function', '42'], true, '$function'), [0, 21]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError(
					{ start: 0, end: 21 },
					'Failed to resolve namespaced ID “spgoding:function/42” in cache category “tag/function” (rule: “strictFunctionTagCheck”)',
					undefined, DiagnosticSeverity.Warning, ErrorCode.IdentityUnknown
				),
			])
		})
		it('Should return errors when the id cannot be resolved in registry', async () => {
			const config = constructConfig({ lint: { strictBlockCheck: ['error', 'only-default-namespace'], idOmitDefaultNamespace: ['warning', true] } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('minecraft:block')
			const actual = parser.parse(new StringReader('qux'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['qux'], undefined, 'minecraft:block'), [0, 3]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError(
					{ start: 0, end: 3 },
					'Failed to resolve namespaced ID “minecraft:qux” in registry “minecraft:block” (rule: “strictBlockCheck”)',
					undefined, DiagnosticSeverity.Error, ErrorCode.IdentityUnknown
				),
			])
		})
		it('Should allow minecraft:empty as loot tables', async () => {
			const config = constructConfig({ lint: { strictBlockCheck: ['error', 'only-default-namespace'], idOmitDefaultNamespace: ['warning', true] } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('$loot_table')
			const actual = parser.parse(new StringReader('empty'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['empty'], undefined, '$loot_table'), [0, 5]))
			assert.deepStrictEqual(actual.errors, [])
		})
		it('Should return warnings when the id cannot be resolved in the array registry', async () => {
			const config = constructConfig({ lint: { idOmitDefaultNamespace: null } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser(['spgoding:foo'])
			const actual = parser.parse(new StringReader('qux'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['qux']), [0, 3]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError(
					{ start: 0, end: 3 },
					'Expected “spgoding:foo” but got “minecraft:qux”',
					undefined, DiagnosticSeverity.Error, ErrorCode.IdentityUnknown
				),
			])
		})
		it('Should return cache when the id is already defined', async () => {
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('$bossbar')
			const actual = parser.parse(new StringReader('spgoding:bossbar/a'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['bossbar', 'a'], undefined, '$bossbar'), [0, 18]))
			assert.deepStrictEqual(actual.cache, {
				bossbar: {
					'spgoding:bossbar/a': {
						ref: [{ start: 0, end: 18 }],
					},
				},
			})
		})
		it('Should return cache even if the id is undefined', async () => {
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('$bossbar')
			const actual = parser.parse(new StringReader('spgoding:bossbar/c'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['bossbar', 'c'], undefined, '$bossbar'), [0, 18]))
			assert.deepStrictEqual(actual.cache, {
				bossbar: {
					'spgoding:bossbar/c': {
						ref: [{ start: 0, end: 18 }],
					},
				},
			})
		})
		it('Should throw error when tags are not allowed here', async () => {
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('minecraft:entity_type')
			const actual = parser.parse(new StringReader('#spgoding:entity_type/1'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('spgoding', ['entity_type', '1'], true, 'minecraft:entity_type'), [0, 23]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError({ start: 0, end: 1 }, 'Tags are not allowed here'),
			])
		})
		it('Should throw error when namespace should be omitted here', async () => {
			const config = constructConfig({ lint: { idOmitDefaultNamespace: ['warning', true] } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('minecraft:block')
			const actual = parser.parse(new StringReader('minecraft:stone'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode('minecraft', ['stone'], undefined, 'minecraft:block'), [0, 15]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError(
					{ start: 0, end: 9 }, 'Default namespace should be omitted here',
					undefined, DiagnosticSeverity.Warning,
					ErrorCode.IdentityOmitDefaultNamespace
				),
			])
		})
		it('Should throw error when namespace cannot be omitted here', async () => {
			const config = constructConfig({ lint: { idOmitDefaultNamespace: ['warning', false] } })
			const ctx = constructContext({ registry: registries, cache, config })
			const parser = new IdentityArgumentParser('minecraft:block', undefined, true)
			const actual = parser.parse(new StringReader('stone'), ctx)
			assert.deepStrictEqual(actual.data, $(new IdentityNode(undefined, ['stone'], undefined, 'minecraft:block'), [0, 5]))
			assert.deepStrictEqual(actual.errors, [
				new ParsingError(
					{ start: 0, end: 5 }, "Default namespace shouldn't be omitted here",
					undefined, DiagnosticSeverity.Warning,
					ErrorCode.IdentityCompleteDefaultNamespace
				),
			])
		})
	})
})
