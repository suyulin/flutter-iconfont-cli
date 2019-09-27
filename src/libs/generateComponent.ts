import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import glob from 'glob';
import colors from 'colors';
import { snakeCase } from 'lodash';
import { XmlData } from './fetchXml';
import { Config } from './getConfig';
import { getTemplate } from './getTemplate';
import {
  replaceCases,
  replaceNames,
  replaceSize,
  replaceSummaryIcon,
} from './replace';
import { whitespace } from './whitespace';

const ATTRIBUTE_FILL_MAP = ['path'];

export const generateComponent = (data: XmlData, config: Config) => {
  const names: string[] = [];
  const saveDir = path.resolve(config.save_dir);
  let cases: string = '';

  mkdirp.sync(saveDir);
  glob.sync(path.join(saveDir, '*')).forEach((file) => fs.unlinkSync(file));

  data.svg.symbol.forEach((item) => {
    const iconId = item.$.id;
    const iconIdAfterTrim = snakeCase(config.trim_icon_prefix
      ? iconId.replace(new RegExp(`^${config.trim_icon_prefix}(.+?)$`), '$1')
      : iconId);

    names.push(iconIdAfterTrim);

    cases += `${whitespace(6)}case IconNames.${iconIdAfterTrim}:\n`;
    cases += `${whitespace(8)}svgXml = '''${generateCase(item, 10)}${whitespace(8)}''';\n`;
    cases += `${whitespace(8)}break;\n`;
  });

  let iconFile =  getTemplate('Icon.dart');

  iconFile = replaceSize(iconFile, config.default_icon_size);
  iconFile = replaceCases(iconFile, cases);
  iconFile = replaceNames(iconFile, names);
  iconFile = replaceSummaryIcon(iconFile, config.summary_component_name);

  fs.writeFileSync(path.join(saveDir, config.summary_component_name + '.dart'), iconFile);

  console.log(`\n${colors.green('√')} All icons have putted into dir: ${colors.green(config.save_dir)}\n`);
};

const generateCase = (data: XmlData['svg']['symbol'][number], baseIdent: number) => {
  let template = `\n${whitespace(baseIdent)}<svg viewBox="${data.$.viewBox}" xmlns="http://www.w3.org/2000/svg">\n`;

  for (const domName of Object.keys(data)) {
    if (domName === '$') {
      continue;
    }

    if (!domName) {
      console.error(colors.red(`Unable to transform dom "${domName}"`));
      process.exit(1);
    }

    const counter = {
      colorIndex: 0,
      baseIdent,
    };

    if (data[domName].$) {
      template += `${whitespace(baseIdent + 2)}<${domName}${addAttribute(domName, data[domName], counter)}\n${whitespace(baseIdent + 2)}/>\n`;
    } else if (Array.isArray(data[domName])) {
      data[domName].forEach((sub) => {
        template += `${whitespace(baseIdent + 2)}<${domName}${addAttribute(domName, sub, counter)}\n${whitespace(baseIdent + 2)}/>\n`;
      });
    }
  }

  template += `${whitespace(baseIdent)}</svg>\n`;

  return template;
};

const addAttribute = (domName: string, sub: XmlData['svg']['symbol'][number]['path'][number], counter: { colorIndex: number, baseIdent: number }) => {
  let template = '';

  if (sub && sub.$) {
    if (ATTRIBUTE_FILL_MAP.includes(domName)) {
      // Set default color same as in iconfont.cn
      // And create placeholder to inject color by user's behavior
      sub.$.fill = sub.$.fill || '#333333';
    }

    for (const attributeName of Object.keys(sub.$)) {
      if (attributeName === 'fill') {
        template += `\n${whitespace(counter.baseIdent + 4)}${attributeName}="''' + getColor(${counter.colorIndex}, color, colors, '${sub.$[attributeName]}') + '''"`;
        counter.colorIndex += 1;
      } else {
        template += `\n${whitespace(counter.baseIdent + 4)}${attributeName}="${sub.$[attributeName]}"`;
      }
    }
  }

  return template;
};
