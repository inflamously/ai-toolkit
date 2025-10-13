import { NextRequest, NextResponse } from 'next/server';
import { Job, PrismaClient } from '@prisma/client';
import { TOOLKIT_ROOT } from '@/paths';
import { spawn } from 'child_process';
import { isWindows, getPythonPath } from '@/app/api/jobs/platform-utils';
import { JobConfig } from '@/types';

const prisma = new PrismaClient();

function getLogDir(job: Job) {
  const { config } = JSON.parse(job.job_config) as JobConfig;
  // TODO: Concate string to <path>/<logdir>/<name>_<date><time> where date and time are the last started run

  const logDir = config.process[0].log_dir;
  const createdAt = job.created_at;
  const jobName = job.name;
  if (!logDir || jobName.length <= 0) {
    return null;
  }

  return path.join(TOOLKIT_ROOT, logDir, `${jobName}_`);
}

export async function POST(request: NextRequest, { params }: { params: { jobID: string } }) {
  const { jobID } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobID },
  });

  const logDir = getLogDir(job);

  const additionalEnv: any = {};

  const args = ['-m', 'tensorboard', '--logdir', logDir, '--port', '6006'];

  const pythonPath = getPythonPath();

  try {
    let subprocess;

    if (isWindows) {
      // For Windows, use 'cmd.exe' to open a new command window
      subprocess = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', pythonPath, ...args], {
        env: {
          ...process.env,
          ...additionalEnv,
        },
        cwd: TOOLKIT_ROOT,
        windowsHide: false,
      });
    } else {
      // For non-Windows platforms
      subprocess = spawn(pythonPath, args, {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'], // Changed from 'ignore' to capture output
        env: {
          ...process.env,
          ...additionalEnv,
        },
        cwd: TOOLKIT_ROOT,
      });
    }

    // Start monitoring in the background without blocking the response
    const monitorProcess = async () => {
      const startTime = Date.now();
      let errorOutput = '';
      let stdoutput = '';

      if (subprocess.stderr) {
        subprocess.stderr.on('data', data => {
          errorOutput += data.toString();
        });
        subprocess.stdout.on('data', data => {
          stdoutput += data.toString();
          // truncate to only get the last 500 characters
          if (stdoutput.length > 500) {
            stdoutput = stdoutput.substring(stdoutput.length - 500);
          }
        });
      }

      subprocess.on('exit', async code => {});

      // Wait 30 seconds before releasing the process
      await new Promise(resolve => setTimeout(resolve, 30000));
      // Detach the process for non-Windows systems
      if (!isWindows && subprocess.unref) {
        subprocess.unref();
      }
    };

    // Return the response immediately
    return NextResponse.json(job);
  } catch (error: any) {
    // Handle any exceptions during process launch
    console.error('Error launching process:', error);

    return NextResponse.json(
      {
        error: 'Failed to launch job process',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}
