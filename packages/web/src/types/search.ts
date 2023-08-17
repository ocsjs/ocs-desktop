import { CommonUserScript, ScriptSearchEngineType, ScriptVersionProvider } from './user.script';

export interface ScriptSearchEngine {
	type: ScriptSearchEngineType;
	name: string;
	homepage: string;
	search: (keyword: string, page: number, size: number) => Promise<CommonUserScript[]>;
	versionProvider: ScriptVersionProvider;
}
