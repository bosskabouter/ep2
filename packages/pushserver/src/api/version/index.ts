import { execSync } from "child_process";

const git_command = "git rev-parse HEAD";
export default () => {
  return execSync(git_command).toString().trim();
};
