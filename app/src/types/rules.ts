export interface RuleSubrule {
  number: string
  text: string
}

export interface Rule {
  number: string
  text: string
  subrules: RuleSubrule[]
}

export interface RuleSection {
  number: string
  title: string
  rules: Rule[]
}

export interface RulePart {
  number: number
  title: string
  sections: RuleSection[]
}

export interface GlossaryEntry {
  term: string
  definition: string
}

export interface ComprehensiveRules {
  title: string
  version: string
  source: string
  parts: RulePart[]
  glossary: GlossaryEntry[]
}

export interface RuleSearchHit {
  kind: 'rule' | 'subrule' | 'glossary'
  partNumber?: number
  partTitle?: string
  sectionNumber?: string
  sectionTitle?: string
  number?: string
  term?: string
  text: string
}
