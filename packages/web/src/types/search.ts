import { CommonUserScript, ScriptSearchEngineType, ScriptVersionProvider } from './user.script';

export interface ScriptSearchEngine {
	type: ScriptSearchEngineType;
	name: string;
	homepage: string;
	search: (keyword: string, page: number, size: number) => Promise<CommonUserScript[]>;
	infoGetter: (script: CommonUserScript) => Promise<any>;
	transformToCommonByInfo: <T>(script: CommonUserScript, info: T) => CommonUserScript;
	versionProvider: ScriptVersionProvider;
}
