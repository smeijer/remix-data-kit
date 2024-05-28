import { execSync } from 'child_process';

const arg = process.argv.slice(2);
const [releaseType] = arg;

if (!releaseType || !['major', 'minor', 'patch'].includes(releaseType)) {
	console.error(`please specify major | minor | patch`);
	process.exit(0);
}

execSync(`npm run build`, { stdio: 'inherit' });
execSync(`npm version ${releaseType}`, { stdio: 'inherit' });
execSync(`npm publish ./dist`, { stdio: 'inherit' });
