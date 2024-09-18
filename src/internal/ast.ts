import { format } from 'prettier';
import { Node, Project, SourceFile } from 'ts-morph';

export async function isStructurallySame(before: string, after: string): Promise<boolean> {
	const project = new Project();

	const formatted1 = await format(before, { parser: 'typescript' });
	const formatted2 = await format(after, { parser: 'typescript' });

	const source1 = project.createSourceFile('before.ts', formatted1);
	const source2 = project.createSourceFile('after.ts', formatted2);

	const leafNodes1 = getLeafNodes(source1);
	const leafNodes2 = getLeafNodes(source2);

	while (true) {
		const leaf1 = leafNodes1.next();
		const leaf2 = leafNodes2.next();

		if (leaf1.done && leaf2.done) return true;
		if (leaf1.done || leaf2.done) return false;

		if (leaf1.value.getKind() !== leaf2.value.getKind()) return false;
		if (leaf1.value.getText() !== leaf2.value.getText()) return false;
	}
}

function* getLeafNodes(sourceFile: SourceFile) {
	yield* searchNode(sourceFile);

	function* searchNode(node: Node): Generator<Node, void, Node> {
		const children = node.getChildren();
		if (children.length === 0) {
			yield node;
		} else {
			for (const child of children) yield* searchNode(child);
		}
	}
}
