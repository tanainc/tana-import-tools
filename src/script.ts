import { WebObsidianVaultConverter } from './converters/obsidian/WebObsidianVaultConverter';

const zipInput = document.getElementById('vault-zip') as HTMLInputElement;
zipInput.addEventListener('change', async (event) => {
  const zipFile = ((event.target as HTMLInputElement).files as FileList)[0];
  const vaultName = zipFile.name.slice(0, zipFile.name.indexOf('.zip'));
  const progress = document.createElement('b');
  progress.innerHTML = 'In Progress... (imagine a fancy timer with 10-30 secs here)<br>';
  document.body.appendChild(progress);

  const [summary, , adapter] = await WebObsidianVaultConverter(zipFile, vaultName, 1);
  document.body.removeChild(progress);

  const success = document.createElement('b');
  success.innerHTML = 'Success!<br>';
  document.body.appendChild(success);

  const summaryHeading = document.createElement('h2');
  summaryHeading.innerText = 'Summary:';
  document.body.appendChild(summaryHeading);
  const summaryElement = document.createElement('p');
  summaryElement.innerText = Object.entries(summary)
    .map((entry) => entry[0] + ': ' + entry[1])
    .join('\n');
  document.body.appendChild(summaryElement);

  const result = adapter.getResult();
  const downloadButton = document.createElement('button');
  downloadButton.innerText = 'Download TIF File';
  downloadButton.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([result]));
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = vaultName + '.tif.json';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
  });
  document.body.appendChild(downloadButton);
});
