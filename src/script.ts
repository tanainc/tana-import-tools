import { WebObsidianVaultConverter } from './converters/obsidian/WebObsidianVaultConverter';

const zipInput = document.getElementById('vault-zip') as HTMLInputElement;
zipInput.addEventListener('change', async (event) => {
  let progress;

  try {
    const zipFile = ((event.target as HTMLInputElement).files as FileList)[0];
    const vaultName = zipFile.name.slice(0, zipFile.name.indexOf('.zip'));
    progress = document.createElement('b');
    progress.innerHTML = 'In Progress... (imagine a fancy timer with 10-30 secs here)<br>';
    document.body.appendChild(progress);

    const [summary, , adapter] = await WebObsidianVaultConverter(zipFile, vaultName, Date.now());
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
  } catch (error) {
    console.trace(error);

    if (progress) {
      document.body.removeChild(progress);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stackStr: string = (error as any).stack.toString();

    document.body.appendChild(document.createElement('br'));
    const errorParagraph = document.createElement('b');
    errorParagraph.innerText = 'An Error occured.';
    document.body.appendChild(errorParagraph);
    if (stackStr.toLowerCase().includes('readdirectory')) {
      document.body.appendChild(document.createElement('br'));
      document.body.appendChild(document.createElement('br'));
      const additionalInfo = document.createElement('b');
      additionalInfo.innerText =
        'It probably has to do with a not properly zipped vault.\nPlease check the text at the top again.';
      document.body.appendChild(additionalInfo);
    }

    document.body.appendChild(document.createElement('br'));
    document.body.appendChild(document.createElement('br'));
    const errorContent = document.createElement('b');
    errorContent.innerText = 'Content of Error (please post in the Slack):\n\n' + stackStr;
    document.body.appendChild(errorContent);
  }
});
