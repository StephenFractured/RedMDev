export const nativeHref = (hash: string) => `/natives/${hash.toLowerCase()}`;
export const categoryHref = (path: string) => '/d/' + path.split('/').map(encodeURIComponent).join('/');
export const datasetIndex = (datasetId: string) => datasetId.slice(datasetId.lastIndexOf('#') + 1);
export const entryHref = (datasetId: string, ord: number) => {
  const cat = datasetId.slice(0, datasetId.lastIndexOf('#'));
  return `${categoryHref(cat)}?ds=${datasetIndex(datasetId)}&row=${ord}#ds-${datasetIndex(datasetId)}`;
};
